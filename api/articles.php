<?php
declare(strict_types=1);

final class ArticleError extends RuntimeException {
    public function __construct(public string $errorCode, string $message, public int $status = 422) { parent::__construct($message); }
}

/** Shared persistence/validation for JSON API, public SSR and sitemap. No automatic DDL. */
final class ArticleStore {
    public const SERVICES = ['studio-content-production','reels-production','commercial-video-production','podcast-production','event-coverage','social-media-management','creative-design-branding','web-design-development','software-development','ai-video-production'];
    public function __construct(public PDO $pdo, public int $org, public string $projectRoot) {}
    public static function now(): string { return gmdate('Y-m-d H:i:s'); }
    public static function iso(?string $date): ?string { return $date ? str_replace(' ', 'T', $date).'Z' : null; }
    public static function text(mixed $value, int $max = 20000): string {
        if (!is_string($value) && !is_numeric($value)) return '';
        $value = trim(preg_replace('/[\x00-\x08\x0B\x0C\x0E-\x1F]/u', '', (string)$value) ?? '');
        if (mb_strlen($value) > $max) throw new ArticleError('article_field_too_long','النص أطول من الحد المسموح.');
        return $value;
    }
    public static function locale(string $lang): string {
        if (!in_array($lang,['ar','en'],true)) throw new ArticleError('article_invalid_locale','اللغة غير مدعومة.',404);
        return $lang;
    }
    public static function slug(mixed $value): string {
        $value=mb_strtolower(self::text($value,160));
        if (!preg_match('/^[\p{L}\p{N}]+(?:-[\p{L}\p{N}]+)*$/u',$value)) throw new ArticleError('article_invalid_slug','استخدم رابطًا مكوّنًا من حروف وأرقام وشرطات.');
        return $value;
    }
    public static function service(mixed $value): string {
        $value=self::text($value,100);
        if ($value!==''&&!in_array($value,self::SERVICES,true)) throw new ArticleError('article_invalid_service','اختر خدمة موجودة بالموقع.');
        return $value;
    }
    public function run(string $sql,array $args=[]): PDOStatement { $s=$this->pdo->prepare($sql);$s->execute($args);return $s; }
    public function ready(): bool {
        try { $this->pdo->query('SELECT id FROM articles LIMIT 1');return true; } catch(PDOException $e) { return false; }
    }
    public function requireReady(): void { if(!$this->ready())throw new ArticleError('articles_migration_required','قسم المقالات يحتاج تهيئة قاعدة البيانات من مسؤول النظام.',503); }
    public static function canEdit(?array $user): bool { return $user && in_array($user['role']??'', ['owner','admin'],true); }
    public function requireEditor(?array $user): array {
        if(!$user) throw new ArticleError('unauthorized','يجب تسجيل الدخول أولًا.',401);
        if(!self::canEdit($user)||(int)$user['organization_id']!==$this->org) throw new ArticleError('forbidden','ليس لديك صلاحية إدارة المقالات.',403);
        return $user;
    }
    public function categories(bool $public=false,string $lang='ar'): array {
        $rows=$this->run('SELECT * FROM article_categories WHERE organization_id=? ORDER BY id',[$this->org])->fetchAll();
        if(!$public)return $rows;
        // Only useful categories appear in public navigation; empty categories stay manageable.
        $ids=array_unique(array_map(fn($r)=>(int)$r['category_id'],$this->publishedRows($lang)));
        return array_values(array_filter($rows,fn($r)=>in_array((int)$r['id'],$ids,true)));
    }
    public function categorySave(array $data,?int $id,array $user): array {
        $this->requireEditor($user);
        $v=[self::slug($data['slug']??''),self::text($data['name_ar']??'',160),self::text($data['name_en']??'',160),self::text($data['description_ar']??'',1000),self::text($data['description_en']??'',1000),self::service($data['service_slug']??'')];
        if(!$v[1]||!$v[2])throw new ArticleError('category_names_required','اسم التصنيف بالعربية والإنجليزية مطلوب.');
        if($id&&!$this->run('SELECT id FROM article_categories WHERE id=? AND organization_id=?',[$id,$this->org])->fetch())throw new ArticleError('not_found','التصنيف غير موجود.',404);
        try {
            if($id)$this->run('UPDATE article_categories SET slug=?,name_ar=?,name_en=?,description_ar=?,description_en=?,service_slug=? WHERE id=? AND organization_id=?',[...$v,$id,$this->org]);
            else {$this->run('INSERT INTO article_categories (slug,name_ar,name_en,description_ar,description_en,service_slug,organization_id) VALUES (?,?,?,?,?,?,?)',[...$v,$this->org]);$id=(int)$this->pdo->lastInsertId();}
        }catch(PDOException $e){if(in_array($e->getCode(),['23000','23505']))throw new ArticleError('category_slug_exists','رابط التصنيف مستخدم بالفعل.',409);throw $e;}
        return $this->run('SELECT * FROM article_categories WHERE id=? AND organization_id=?',[$id,$this->org])->fetch();
    }
    public function categoryDelete(int $id,array $user): void {
        $this->requireEditor($user);
        if($this->run('SELECT id FROM articles WHERE category_id=? AND organization_id=? LIMIT 1',[$id,$this->org])->fetch())throw new ArticleError('category_in_use','التصنيف مستخدم في مقالات. غيّر تصنيفها أولًا.',409);
        $this->run('DELETE FROM article_categories WHERE id=? AND organization_id=?',[$id,$this->org]);
    }
    public function mediaUrl(mixed $raw,string $type='image'): string {
        $url=self::text($raw,600);
        if($url==='')return '';
        if(preg_match('~^/api/articles/media/([a-f0-9]{32})(?:\?audience=staff)?$~',$url,$m)) {
            $media=$this->run('SELECT mime FROM article_media WHERE id=? AND organization_id=?',[$m[1],$this->org])->fetch();
            if(!$media||!str_starts_with($media['mime'],$type.'/'))throw new ArticleError('article_invalid_media','ملف الوسائط غير موجود أو لا يطابق النوع المطلوب.');
            return '/api/articles/media/'.$m[1].'?audience=staff';
        }
        if($type==='image'&&preg_match('~^/brand/[a-zA-Z0-9_/-]+\.(?:webp|png|jpe?g)$~',$url)&&!str_contains($url,'..')&&(is_file($this->projectRoot.'/public'.$url)||is_file($this->projectRoot.'/dist'.$url))) return $url;
        if($type==='video'){
            $parts=parse_url($url);$host=strtolower($parts['host']??'');
            if(($parts['scheme']??'')==='https'&&!isset($parts['user'])&&!isset($parts['port'])&&in_array($host,['youtube.com','www.youtube.com','youtu.be'],true)){
                $id='';if($host==='youtu.be')$id=trim($parts['path']??'','/');
                elseif(preg_match('~^/(?:embed|shorts)/([A-Za-z0-9_-]{11})$~',$parts['path']??'',$v))$id=$v[1];
                elseif(($parts['path']??'')==='/watch'){parse_str($parts['query']??'',$q);$id=$q['v']??'';}
                if(is_string($id)&&preg_match('/^[A-Za-z0-9_-]{11}$/',$id))return 'https://www.youtube.com/embed/'.$id;
            }
        }
        throw new ArticleError('article_invalid_media','ارفع ملفًا آمنًا أو استخدم رابط فيديو يوتيوب مسموحًا.');
    }
    public static function link(mixed $raw): string {
        $url=self::text($raw,600);
        if(preg_match('~^/(?:ar|en)/(?:services|articles|contact|portfolio)(?:/[\p{L}\p{N}_%-]+)*/?(?:#[A-Za-z0-9_-]+)?$~u',$url))return $url;
        $parts=parse_url($url);
        if(($parts['scheme']??'')==='https'&&!empty($parts['host'])&&!isset($parts['user'])&&!isset($parts['pass'])&&!preg_match('/[\s<>"\\\\]/u',$url))return $url;
        throw new ArticleError('article_invalid_link','استخدم رابط HTTPS صحيحًا أو رابط خدمة داخل الموقع.');
    }
    public function blocks(mixed $blocks): array {
        if(!is_array($blocks)||count($blocks)>150)throw new ArticleError('article_invalid_blocks','محتوى المقال غير صالح أو يتجاوز 150 عنصرًا.');
        $clean=[];
        foreach($blocks as $b){
            if(!is_array($b))throw new ArticleError('article_invalid_block','عنصر محتوى غير صالح.');
            $type=$b['type']??'';$v=['type'=>$type];
            switch($type){
                case 'paragraph':case 'quote':$v['text']=self::text($b['text']??'');break;
                case 'heading':$v['text']=self::text($b['text']??'',300);$v['level']=((int)($b['level']??2)===3)?3:2;break;
                case 'list':
                    if(!is_array($b['items']??null)||count($b['items'])>80)throw new ArticleError('article_invalid_list','القائمة غير صالحة.');
                    $v['ordered']=!empty($b['ordered']);$v['items']=array_map(fn($t)=>self::text($t,2000),array_values($b['items']));break;
                case 'table':
                    if(!is_array($b['rows']??null)||count($b['rows'])>40)throw new ArticleError('article_invalid_table','الجدول غير صالح.');
                    $v['rows']=[];foreach($b['rows'] as $row){if(!is_array($row)||count($row)>10)throw new ArticleError('article_invalid_table','الجدول يتجاوز 10 أعمدة.');$v['rows'][]=array_map(fn($t)=>self::text($t,1000),array_values($row));}break;
                case 'image':
                    $v['url']=$this->mediaUrl($b['url']??'');$v['alt']=self::text($b['alt']??'',300);$v['caption']=self::text($b['caption']??'',1000);
                    if(!$v['url']||!$v['alt'])throw new ArticleError('article_image_alt_required','صورة المحتوى ووصفها النصي مطلوبان.');
                    $v['width']=max(0,min(10000,(int)($b['width']??0)));$v['height']=max(0,min(10000,(int)($b['height']??0)));break;
                case 'video':
                    $v['url']=$this->mediaUrl($b['url']??'','video');$v['caption']=self::text($b['caption']??'',2000);
                    if(!$v['url']||!$v['caption'])throw new ArticleError('article_video_caption_required','رابط الفيديو وملخصه النصي مطلوبان.');break;
                case 'link':$v['url']=self::link($b['url']??'');$v['text']=self::text($b['text']??'',300);if(!$v['text'])throw new ArticleError('article_link_label_required','نص الرابط مطلوب.');break;
                default:throw new ArticleError('article_invalid_block','نوع المحتوى غير مدعوم.');
            }
            $clean[]=$v;
        }
        if(strlen(json_encode($clean))>800000)throw new ArticleError('article_content_too_large','حجم محتوى المقال أكبر من المسموح.');
        return $clean;
    }
    public static function visible(array $t,?string $now=null): bool {
        $now??=self::now();
        return empty($t['deleted_at'])&&(($t['status']==='published'&&!empty($t['published_at'])&&$t['published_at']<=$now)||($t['status']==='scheduled'&&!empty($t['scheduled_at'])&&$t['scheduled_at']<=$now));
    }
    public function get(int $id): array {
        $a=$this->run('SELECT * FROM articles WHERE id=? AND organization_id=?',[$id,$this->org])->fetch();
        if(!$a)throw new ArticleError('article_not_found','المقال غير موجود.',404);
        $a['id']=(int)$a['id'];$a['version']=(int)$a['version'];$a['featured']=(bool)$a['featured'];$a['translations']=[];
        foreach($this->run('SELECT * FROM article_translations WHERE article_id=?',[$id])->fetchAll() as $t){
            $t['blocks']=json_decode($t['blocks'],true)?:[];
            if($t['status']==='scheduled'&&self::visible($t)){$t['status']='published';$t['published_at']=$t['published_at']?:$t['scheduled_at'];}
            foreach(['scheduled_at','published_at','updated_at'] as $date)$t[$date]=self::iso($t[$date]);
            $a['translations'][$t['locale']]=$t;
        }
        return $a;
    }
    public function manage(array $filters,array $user): array {
        $this->requireEditor($user);
        $q=self::text($filters['q']??'',120);$lang=self::text($filters['lang']??'',2);$status=self::text($filters['status']??'',20);$category=self::text($filters['category']??'',160);
        $where=['a.organization_id=?',$status==='trash'?'a.deleted_at IS NOT NULL':'a.deleted_at IS NULL'];$args=[$this->org];
        if($lang!==''){$where[]='t.locale=?';$args[]=self::locale($lang);}
        if($category!==''){$where[]='a.category_id IN (SELECT id FROM article_categories WHERE organization_id=? AND (slug=? OR id=?))';array_push($args,$this->org,$category,ctype_digit($category)?(int)$category:0);}
        if($q!==''){$where[]="LOCATE(LOWER(?),LOWER(CONCAT(t.title,' ',t.excerpt)))>0";$args[]=$q;}
        if($status==='published'){$where[]="(t.status='published' OR (t.status='scheduled' AND t.scheduled_at<=?))";$args[]=self::now();}
        elseif($status==='scheduled'){$where[]="t.status='scheduled' AND t.scheduled_at>?";$args[]=self::now();}
        elseif($status==='draft')$where[]="t.status='draft'";
        $from=' FROM articles a JOIN article_translations t ON t.article_id=a.id WHERE '.implode(' AND ',$where);
        $total=(int)$this->run('SELECT COUNT(DISTINCT a.id)'.$from,$args)->fetchColumn();$pages=max(1,(int)ceil($total/25));
        $page=min($pages,max(1,(int)($filters['page']??1)));$offset=($page-1)*25;
        $rows=$this->run('SELECT DISTINCT a.id,a.updated_at'.$from.' ORDER BY a.updated_at DESC,a.id DESC LIMIT 25 OFFSET '.$offset,$args)->fetchAll();
        return ['items'=>array_map(fn($r)=>$this->get((int)$r['id']),$rows),'categories'=>$this->categories(),'can_publish'=>$user['role']==='owner','page'=>$page,'pages'=>$pages,'total'=>$total];
    }
    public function save(array $data,?int $id,array $user): array {
        $this->requireEditor($user);$old=$id?$this->get($id):null;
        if($old&&$old['deleted_at'])throw new ArticleError('article_trashed','استعد المقال من المحذوفات قبل تعديله.',409);
        if($old&&(int)($data['version']??0)!==$old['version'])throw new ArticleError('article_version_conflict','تم تعديل المقال في جلسة أخرى. أعد تحميله قبل الحفظ.',409);
        $author=self::text($data['author_name']??'',160);if($author==='')throw new ArticleError('article_author_required','أدخل اسم الكاتب الحقيقي أو فريق التحرير.');
        $category=(int)($data['category_id']??0)?:null;
        if($category&&!$this->run('SELECT id FROM article_categories WHERE id=? AND organization_id=?',[$category,$this->org])->fetch())throw new ArticleError('article_invalid_category','التصنيف غير موجود.');
        $service=self::service($data['service_slug']??'');$featured=!empty($data['featured'])?1:0;
        $translations=$data['translations']??[];
        if(!is_array($translations)||!count($translations)||array_diff(array_keys($translations),['ar','en']))throw new ArticleError('article_translation_required','أضف نسخة عربية أو إنجليزية للمقال.');
        $clean=[];$now=self::now();
        foreach($translations as $lang=>$t){
            if(!is_array($t))throw new ArticleError('article_invalid_translation','بيانات الترجمة غير صحيحة.');
            $status=(string)($t['status']??'draft');if(!in_array($status,['draft','published','scheduled'],true))throw new ArticleError('article_invalid_status','حالة المقال غير صحيحة.');
            $previous=$old['translations'][$lang]??null;
            $title=self::text($t['title']??'',220);if(!$title)throw new ArticleError('article_title_required','عنوان المقال مطلوب.');
            $slug=self::slug($t['slug']??'');$excerpt=self::text($t['excerpt']??'',1200);$blocks=$this->blocks($t['blocks']??[]);
            $cover=$this->mediaUrl($t['cover_url']??'');$alt=self::text($t['cover_alt']??'',300);
            if($cover&&!$alt)throw new ArticleError('article_image_alt_required','أضف وصفًا نصيًا للصورة البارزة.');
            if($status!=='draft'&&(!$excerpt||!$blocks||!$category))throw new ArticleError('article_publish_incomplete','النشر يحتاج ملخصًا ومحتوى وتصنيفًا.');
            if($user['role']!=='owner'&&($status!=='draft'||($previous&&$previous['status']!=='draft')))throw new ArticleError('article_publish_forbidden','النشر وتعديل المقالات المنشورة متاحان للمالك فقط.',403);
            $scheduled=null;
            if($status==='scheduled'){
                try{$d=new DateTimeImmutable((string)($t['scheduled_at']??''));}catch(Throwable){throw new ArticleError('article_invalid_schedule','اختر موعدًا صحيحًا للنشر.');}
                if(empty($t['scheduled_at'])||$d->getTimestamp()<=time())throw new ArticleError('article_invalid_schedule','موعد الجدولة يجب أن يكون في المستقبل.');
                $scheduled=$d->setTimezone(new DateTimeZone('UTC'))->format('Y-m-d H:i:s');
            }
            $published=$previous['published_at']??null;$published=$published?gmdate('Y-m-d H:i:s',strtotime($published)):null;
            if($status==='published'&&!$published)$published=$now;
            $clean[$lang]=['title'=>$title,'slug'=>$slug,'excerpt'=>$excerpt,'blocks'=>$blocks,'seo_title'=>self::text($t['seo_title']??'',220),'seo_description'=>self::text($t['seo_description']??'',320),'cover_url'=>$cover,'cover_alt'=>$alt,'status'=>$status,'scheduled_at'=>$scheduled,'published_at'=>$published];
        }
        // Omitted translations are preserved; unpublish explicitly instead of silently deleting.
        if($user['role']!=='owner'&&$old&&array_filter($old['translations'],fn($t)=>$t['status']!=='draft'))throw new ArticleError('article_publish_forbidden','المقال يحتوي نسخة منشورة أو مجدولة؛ يحتاج تعديل المالك.',403);
        $this->pdo->beginTransaction();
        try{
            if($id){$s=$this->run('UPDATE articles SET author_name=?,category_id=?,service_slug=?,featured=?,version=version+1,updated_at=? WHERE id=? AND organization_id=? AND version=?',[$author,$category,$service,$featured,$now,$id,$this->org,$old['version']]);if(!$s->rowCount())throw new ArticleError('article_version_conflict','تم تعديل المقال في جلسة أخرى.',409);}
            else{$this->run('INSERT INTO articles (organization_id,author_name,category_id,service_slug,featured,version,created_at,updated_at) VALUES (?,?,?,?,?,1,?,?)',[$this->org,$author,$category,$service,$featured,$now,$now]);$id=(int)$this->pdo->lastInsertId();}
            foreach($clean as $lang=>$t){
                $route=$this->run('SELECT article_id FROM article_routes WHERE organization_id=? AND locale=? AND slug=?',[$this->org,$lang,$t['slug']])->fetch();
                if($route&&(int)$route['article_id']!==$id)throw new ArticleError('article_slug_exists','رابط المقال مستخدم بالفعل، بما في ذلك الروابط القديمة.',409);
                if(!$route)$this->run('INSERT INTO article_routes (organization_id,locale,slug,article_id) VALUES (?,?,?,?)',[$this->org,$lang,$t['slug'],$id]);
                $prev=$old['translations'][$lang]??null;$modified=$now;
                if($prev){$comparison=$t;foreach(['scheduled_at','published_at'] as $date)$comparison[$date]=self::iso($comparison[$date]);$unchanged=true;foreach($comparison as $key=>$val)if(($prev[$key]??null)!==$val)$unchanged=false;
                    if($unchanged&&$author===$old['author_name']&&$category==$old['category_id']&&$service===$old['service_slug'])$modified=gmdate('Y-m-d H:i:s',strtotime($prev['updated_at']));}
                $values=[$t['title'],$t['slug'],$t['excerpt'],json_encode($t['blocks'],JSON_UNESCAPED_UNICODE|JSON_UNESCAPED_SLASHES),$t['seo_title'],$t['seo_description'],$t['cover_url'],$t['cover_alt'],$t['status'],$t['scheduled_at'],$t['published_at'],$modified];
                if($prev)$this->run('UPDATE article_translations SET title=?,slug=?,excerpt=?,blocks=?,seo_title=?,seo_description=?,cover_url=?,cover_alt=?,status=?,scheduled_at=?,published_at=?,updated_at=? WHERE article_id=? AND locale=?',[...$values,$id,$lang]);
                else $this->run('INSERT INTO article_translations (title,slug,excerpt,blocks,seo_title,seo_description,cover_url,cover_alt,status,scheduled_at,published_at,updated_at,article_id,locale) VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?)',[...$values,$id,$lang]);
            }
            $this->log($user,$id,$old?'save':'create');$this->pdo->commit();return $this->get($id);
        }catch(Throwable $e){if($this->pdo->inTransaction())$this->pdo->rollBack();if($e instanceof PDOException&&in_array($e->getCode(),['23000','23505']))throw new ArticleError('article_slug_exists','الرابط مستخدم بالفعل.',409);throw $e;}
    }
    public function log(array $user,?int $id,string $action): void { $this->run('INSERT INTO article_audit (organization_id,actor_id,article_id,action,created_at) VALUES (?,?,?,?,?)',[$this->org,$user['id'],$id,$action,self::now()]); }
    public function trash(int $id,int $version,bool $restore,array $user): array {
        $this->requireEditor($user);$a=$this->get($id);
        if($user['role']!=='owner'&&array_filter($a['translations'],fn($t)=>$t['status']!=='draft'))throw new ArticleError('article_publish_forbidden','إلغاء ظهور المحتوى المنشور يحتاج صلاحية المالك.',403);
        $this->pdo->beginTransaction();try{
            $s=$this->run('UPDATE articles SET deleted_at=?,version=version+1,updated_at=? WHERE id=? AND organization_id=? AND version=?',[$restore?null:self::now(),self::now(),$id,$this->org,$version]);
            if(!$s->rowCount())throw new ArticleError('article_version_conflict','أعد تحميل المقال قبل تنفيذ الإجراء.',409);
            $this->run("UPDATE article_translations SET status='draft',scheduled_at=NULL WHERE article_id=?",[$id]);
            $this->log($user,$id,$restore?'restore':'trash');$this->pdo->commit();return $this->get($id);
        }catch(Throwable $e){$this->pdo->rollBack();throw $e;}
    }
    public function publishedRows(?string $lang=null): array {
        $now=self::now();$where=$lang?' AND t.locale=?':'';
        return $this->run("SELECT a.id,a.author_name,a.category_id,a.service_slug,a.featured,a.deleted_at,t.* FROM articles a JOIN article_translations t ON t.article_id=a.id WHERE a.organization_id=? AND a.deleted_at IS NULL AND ((t.status='published' AND t.published_at<=?) OR (t.status='scheduled' AND t.scheduled_at<=?))".$where.' ORDER BY COALESCE(t.published_at,t.scheduled_at) DESC,a.id DESC',$lang?[$this->org,$now,$now,$lang]:[$this->org,$now,$now])->fetchAll();
    }
    public function translations(int $id): array {
        $now=self::now();$result=[];
        $rows=$this->run("SELECT t.locale,t.slug FROM article_translations t JOIN articles a ON a.id=t.article_id WHERE a.id=? AND a.organization_id=? AND a.deleted_at IS NULL AND ((t.status='published' AND t.published_at<=?) OR (t.status='scheduled' AND t.scheduled_at<=?))",[$id,$this->org,$now,$now])->fetchAll();
        foreach($rows as $r)$result[$r['locale']]='/'.$r['locale'].'/articles/'.rawurlencode($r['slug']).'/';return $result;
    }
    public function publicArticle(array $r,bool $preview=false): array {
        $r['id']=(int)($r['id']??$r['article_id']);$r['blocks']=is_array($r['blocks'])?$r['blocks']:(json_decode($r['blocks'],true)?:[]);
        $r['category']=$r['category_id']?$this->run('SELECT * FROM article_categories WHERE id=? AND organization_id=?',[$r['category_id'],$this->org])->fetch():null;
        $r['translations']=$preview?[]:$this->translations($r['id']);
        $text=$r['excerpt'].' '.implode(' ',array_map(fn($b)=>($b['text']??'').' '.implode(' ',$b['items']??[]),$r['blocks']));
        $r['reading_minutes']=max(1,(int)ceil(count(preg_split('/\s+/u',trim($text)))/200));
        $r['published_at']=$r['published_at']?:($preview?null:$r['scheduled_at']);
        foreach(['published_at','updated_at'] as $date)if(!empty($r[$date])&&!str_ends_with($r[$date],'Z'))$r[$date]=self::iso($r[$date]);
        if($r['published_at']&&$r['updated_at']<$r['published_at'])$r['updated_at']=$r['published_at'];
        $keys=['id','locale','title','slug','excerpt','blocks','seo_title','seo_description','cover_url','cover_alt','author_name','category','service_slug','featured','published_at','updated_at','reading_minutes','translations'];
        return array_intersect_key($r,array_flip($keys));
    }
    public function publicCard(array $row): array {
        $card=$this->publicArticle($row);unset($card['blocks']);return $card;
    }
    public function listing(string $lang,array $query): array {
        self::locale($lang);$page=filter_var($query['page']??1,FILTER_VALIDATE_INT,['options'=>['min_range'=>1,'max_range'=>10000]]);
        if(!$page)throw new ArticleError('article_page_not_found','الصفحة غير موجودة.',404);
        $q=self::text($query['q']??'',120);$category=self::text($query['category']??'',160);$rows=$this->publishedRows($lang);
        $categories=$this->categories(true,$lang);
        if($category!==''){$cat=array_values(array_filter($categories,fn($c)=>$c['slug']===$category));$rows=$cat?array_values(array_filter($rows,fn($r)=>(int)$r['category_id']===(int)$cat[0]['id'])):[];}
        if($q!=='')$rows=array_values(array_filter($rows,fn($r)=>str_contains(mb_strtolower($r['title'].' '.$r['excerpt'].' '.$r['blocks']),mb_strtolower($q))));
        // Keep the optional featured article on page one without duplicating it on later pages.
        if(!$q&&!$category)usort($rows,fn($a,$b)=>(int)$b['featured']<=>(int)$a['featured']);
        $total=count($rows);$pages=max(1,(int)ceil($total/9));if($page>$pages)throw new ArticleError('article_page_not_found','الصفحة غير موجودة.',404);
        $featured=null;if(!$q&&!$category&&$page===1)foreach($rows as $row)if($row['featured']){$featured=$this->publicCard($row);break;}
        return ['items'=>array_map(fn($r)=>$this->publicCard($r),array_slice($rows,($page-1)*9,9)),'featured'=>$featured,'categories'=>$categories,'page'=>$page,'pages'=>$pages,'total'=>$total,'query'=>['q'=>$q,'category'=>$category,'page'=>$page]];
    }
    public function detail(string $lang,string $slug): array {
        self::locale($lang);$row=null;$all=$this->publishedRows($lang);
        foreach($all as $r)if($r['slug']===$slug){$row=$r;break;}
        if(!$row){$route=$this->run('SELECT article_id FROM article_routes WHERE organization_id=? AND locale=? AND slug=?',[$this->org,$lang,$slug])->fetch();if($route)foreach($all as $r)if((int)$r['id']===(int)$route['article_id'])return ['redirect'=>'/'.$lang.'/articles/'.rawurlencode($r['slug']).'/'];throw new ArticleError('article_not_found','المقال غير موجود أو غير منشور.',404);}
        $article=$this->publicArticle($row);$related=array_values(array_filter($all,fn($r)=>$r['id']!=$row['id']&&$r['category_id']==$row['category_id']));
        return ['article'=>$article,'related'=>array_map(fn($r)=>$this->publicCard($r),array_slice($related,0,3)),'translations'=>$article['translations']];
    }
    public function preview(int $id,string $lang,array $user): array {
        $this->requireEditor($user);self::locale($lang);$a=$this->get($id);$t=$a['translations'][$lang]??null;
        if(!$t)throw new ArticleError('article_not_found','الترجمة غير موجودة.',404);
        return ['article'=>$this->publicArticle(array_merge($a,$t,['id'=>$id]),true),'related'=>[],'translations'=>[]];
    }
}
