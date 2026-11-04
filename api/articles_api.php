<?php
declare(strict_types=1);
require_once __DIR__.'/articles.php';

function articlesUploadDirectory(array $config): string {
    $dir=(string)($config['app']['article_upload_dir']??dirname(__DIR__,2).'/private_uploads/articles');
    $resolved=realpath($dir);
    if(!$resolved||!is_dir($resolved)||!is_writable($resolved))throw new ArticleError('article_upload_unavailable','مجلد رفع المقالات غير جاهز. تواصل مع مسؤول النظام.',503);
    $root=realpath(dirname(__DIR__));
    if($root&&str_starts_with(strtolower(str_replace('\\','/',$resolved)).'/',strtolower(str_replace('\\','/',$root)).'/'))throw new ArticleError('article_upload_configuration','يجب حفظ وسائط المقالات خارج مجلد الموقع.',503);
    return $resolved;
}
function articlesUpload(ArticleStore $store,array $config,array $user): array {
    $store->requireEditor($user);$file=$_FILES['file']??null;
    if(!is_array($file)||($file['error']??UPLOAD_ERR_NO_FILE)!==UPLOAD_ERR_OK)throw new ArticleError('article_file_required','اختر ملفًا صالحًا للرفع.');
    $temp=(string)$file['tmp_name'];$size=filesize($temp);
    if(!is_uploaded_file($temp)||$size<1||$size>40*1024*1024)throw new ArticleError('article_file_size','حجم الفيديو الأقصى 40 ميجابايت والصورة 8 ميجابايت.',413);
    $mime=(new finfo(FILEINFO_MIME_TYPE))->file($temp);$types=['image/jpeg'=>'jpg','image/png'=>'png','image/webp'=>'webp','video/mp4'=>'mp4','video/webm'=>'webm'];
    if(!isset($types[$mime]))throw new ArticleError('article_file_type','الصيغ المسموحة: JPG، PNG، WebP، MP4، WebM.');
    $id=bin2hex(random_bytes(16));$width=0;$height=0;$dir=articlesUploadDirectory($config);
    if(str_starts_with($mime,'image/')){
        if($size>8*1024*1024)throw new ArticleError('article_file_size','حجم الصورة الأقصى 8 ميجابايت.',413);
        $info=@getimagesize($temp);if(!$info||$info[0]*$info[1]>24000000)throw new ArticleError('article_image_dimensions','الصورة غير صالحة أو تتجاوز 24 مليون بكسل.');
        if(!function_exists('imagewebp'))throw new ArticleError('article_image_processor_missing','معالج ضغط الصور غير متاح بالخادم.',503);
        $image=@imagecreatefromstring(file_get_contents($temp));if(!$image)throw new ArticleError('article_file_type','تعذر قراءة الصورة.');
        $scale=min(1,1920/max($info[0],$info[1]));$width=max(1,(int)round($info[0]*$scale));$height=max(1,(int)round($info[1]*$scale));
        $canvas=imagecreatetruecolor($width,$height);imagealphablending($canvas,false);imagesavealpha($canvas,true);imagecopyresampled($canvas,$image,0,0,0,0,$width,$height,$info[0],$info[1]);
        $filename=$id.'.webp';$saved=imagewebp($canvas,$dir.'/'.$filename,84);$mime='image/webp';imagedestroy($canvas);imagedestroy($image);
        if(!$saved)throw new ArticleError('article_upload_failed','تعذر حفظ الصورة.',500);
    }else{
        $filename=$id.'.'.$types[$mime];
        if(!move_uploaded_file($temp,$dir.'/'.$filename))throw new ArticleError('article_upload_failed','تعذر حفظ الفيديو.',500);
    }
    try{$store->run('INSERT INTO article_media (id,organization_id,filename,mime,width,height,created_at) VALUES (?,?,?,?,?,?,?)',[$id,$store->org,$filename,$mime,$width,$height,ArticleStore::now()]);}
    catch(Throwable $e){@unlink($dir.'/'.$filename);throw $e;}
    return ['url'=>'/api/articles/media/'.$id.'?audience=staff','width'=>$width,'height'=>$height,'type'=>str_starts_with($mime,'image/')?'image':'video','name'=>ArticleStore::text($file['name']??'',255)];
}
function articlesServeMedia(ArticleStore $store,array $config,string $id,?array $user): never {
    $m=$store->run('SELECT * FROM article_media WHERE id=? AND organization_id=?',[$id,$store->org])->fetch();
    $public=false;
    if($m)foreach($store->publishedRows() as $t)if(str_contains($t['cover_url'],$id)||str_contains($t['blocks'],$id)){$public=true;break;}
    if(!$m||(!$public&&(!ArticleStore::canEdit($user)||(int)$user['organization_id']!==$store->org)))throw new ArticleError('not_found','الملف غير موجود.',404);
    $path=articlesUploadDirectory($config).'/'.$m['filename'];if(!is_file($path))throw new ArticleError('not_found','الملف غير موجود.',404);
    $size=filesize($path);$start=0;$end=$size-1;
    header('Content-Type: '.$m['mime']);header('Content-Disposition: inline; filename="'.$m['filename'].'"');header('X-Content-Type-Options: nosniff');header('Cache-Control: no-store');header('Accept-Ranges: bytes');
    if(isset($_SERVER['HTTP_RANGE'])){
        if(!preg_match('/^bytes=(\d*)-(\d*)$/',$_SERVER['HTTP_RANGE'],$range)||($range[1]===''&&$range[2]==='')){http_response_code(416);header('Content-Range: bytes */'.$size);exit;}
        if($range[1]==='')$start=max(0,$size-(int)$range[2]);else{$start=(int)$range[1];if($range[2]!=='')$end=min($end,(int)$range[2]);}
        if($start>$end||$start>=$size){http_response_code(416);header('Content-Range: bytes */'.$size);exit;}
        http_response_code(206);header("Content-Range: bytes $start-$end/$size");
    }
    header('Content-Length: '.($end-$start+1));if(($_SERVER['REQUEST_METHOD']??'GET')==='HEAD')exit;
    $handle=fopen($path,'rb');fseek($handle,$start);$remaining=$end-$start+1;while($remaining>0&&!feof($handle)){ $chunk=fread($handle,min(65536,$remaining));echo $chunk;$remaining-=strlen($chunk); }fclose($handle);exit;
}
function handleArticlesApi(PDO $pdo,array $config,string $path,string $method,?array $user): void {
    if(!preg_match('~^/(?:public/articles|articles)(?:/|$)~',$path))return;
    $org=(int)($config['articles']['organization_id']??$config['registration']['organization_id']??1);
    $private=!str_starts_with($path,'/public/');
    $store=new ArticleStore($pdo,$private&&$user?(int)$user['organization_id']:$org,dirname(__DIR__));
    try{
        // Deny anonymous access before querying CMS tables, including uninstalled environments.
        if($private&&!preg_match('~^/articles/media/[a-f0-9]{32}$~',$path))$store->requireEditor($user);
        $store->requireReady();
        if($method==='GET'&&$path==='/public/articles')respond($store->listing((string)($_GET['lang']??'ar'),$_GET));
        if($method==='GET'&&preg_match('~^/public/articles/([^/]+)$~',$path,$m))respond($store->detail((string)($_GET['lang']??'ar'),rawurldecode($m[1])));
        if($method==='GET'&&$path==='/articles/manage')respond($store->manage($_GET,$user));
        if($method==='POST'&&$path==='/articles/manage')respond($store->save(body(),null,$user),201);
        if(preg_match('~^/articles/manage/(\d+)$~',$path,$m)){
            if($method==='GET')respond($store->get((int)$m[1]));
            if($method==='PATCH')respond($store->save(body(),(int)$m[1],$user));
        }
        if($method==='GET'&&preg_match('~^/articles/manage/(\d+)/preview$~',$path,$m))respond($store->preview((int)$m[1],(string)($_GET['lang']??'ar'),$user));
        if($method==='POST'&&preg_match('~^/articles/manage/(\d+)/(trash|restore)$~',$path,$m))respond($store->trash((int)$m[1],(int)(body()['version']??0),$m[2]==='restore',$user));
        if($path==='/articles/categories'){
            if($method==='GET')respond($store->categories());
            if($method==='POST')respond($store->categorySave(body(),null,$user),201);
        }
        if(preg_match('~^/articles/categories/(\d+)$~',$path,$m)){
            if($method==='PATCH')respond($store->categorySave(body(),(int)$m[1],$user));
            if($method==='DELETE'){$store->categoryDelete((int)$m[1],$user);respond(['deleted'=>true]);}
        }
        if($path==='/articles/media'&&$method==='POST')respond(articlesUpload($store,$config,$user),201);
        if(in_array($method,['GET','HEAD'],true)&&preg_match('~^/articles/media/([a-f0-9]{32})$~',$path,$m))articlesServeMedia($store,$config,$m[1],$user);
        throw new ArticleError('not_found','المسار غير موجود.',404);
    }catch(ArticleError $e){fail($e->getMessage(),$e->status,$e->errorCode);}
}
