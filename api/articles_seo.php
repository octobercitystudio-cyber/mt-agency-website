<?php
declare(strict_types=1);
const ARTICLES_SITE='https://multitaskagency.com';
function articlesEscape(mixed $v): string { return htmlspecialchars((string)$v,ENT_QUOTES|ENT_SUBSTITUTE,'UTF-8'); }
function articlesJson(mixed $v): string { return json_encode($v,JSON_UNESCAPED_UNICODE|JSON_UNESCAPED_SLASHES|JSON_HEX_TAG|JSON_HEX_AMP|JSON_HEX_APOS|JSON_HEX_QUOT|JSON_THROW_ON_ERROR); }
function articlesMeta(array $data,string $kind,string $lang): array {
    $en=$lang==='en';$base='/'.$lang.'/articles/';$article=$data['article']??null;
    $title=$article?($article['seo_title']?:$article['title']):($en?'Articles':'المقالات');
    $desc=$article?($article['seo_description']?:$article['excerpt']):($en?'Answers to help you plan your next video, podcast, event coverage or social media project.':'إجابات تساعدك على التخطيط للتصوير والبودكاست وتغطية الفعاليات وإدارة محتواك.');
    $page=(int)($data['page']??1);if(!$article&&$page>1)$title.=($en?' — Page ':' — صفحة ').$page;$canonical=ARTICLES_SITE.($article?$base.rawurlencode($article['slug']).'/':$base.($page>1?'?page='.$page:''));
    if($kind==='error'){$title=$en?'Article not found':'المقال غير موجود';$desc=$en?'The requested article is not available.':'المقال المطلوب غير متاح.';}
    $filtered=!empty($_GET['q'])||!empty($_GET['category'])||!empty($_GET['translation']);
    $noindex=$kind==='error'||$filtered||($kind==='list'&&empty($data['total']));
    $alternates=$article?($data['translations']??$article['translations']??[]):($kind==='list'&&$page===1&&!$filtered?['ar'=>'/ar/articles/','en'=>'/en/articles/']:[]);
    if($noindex)$alternates=[];
    $image=$article['cover_url']??'/brand/gold/mt-agency-logo.webp';if(!$image)$image='/brand/gold/mt-agency-logo.webp';if(str_starts_with($image,'/'))$image=ARTICLES_SITE.$image;
    $graph=[];
    if(!$noindex){
        $crumbs=[['@type'=>'ListItem','position'=>1,'name'=>$en?'Home':'الرئيسية','item'=>ARTICLES_SITE.'/'.$lang.'/'],['@type'=>'ListItem','position'=>2,'name'=>$en?'Articles':'المقالات','item'=>ARTICLES_SITE.$base]];
        if($article)$crumbs[]=['@type'=>'ListItem','position'=>3,'name'=>$article['title'],'item'=>$canonical];
        $graph[]=['@type'=>'BreadcrumbList','@id'=>$canonical.'#breadcrumb','itemListElement'=>$crumbs];
        if($article){
            $author=$article['author_name'];$editorial=str_contains($author,'فريق التحرير')||stripos($author,'editorial')!==false||stripos($author,'Multi Task Agency')!==false;
            $graph[]=['@type'=>'BlogPosting','@id'=>$canonical.'#article','mainEntityOfPage'=>['@type'=>'WebPage','@id'=>$canonical],'headline'=>$article['title'],'description'=>$article['excerpt'],...(!empty($article['cover_url'])?['image'=>[$image]]:[]),'inLanguage'=>$lang,'datePublished'=>$article['published_at'],'dateModified'=>$article['updated_at'],'author'=>['@type'=>$editorial?'Organization':'Person','name'=>$author],'publisher'=>['@type'=>'Organization','@id'=>ARTICLES_SITE.'/#organization','name'=>'Multi Task Agency','logo'=>['@type'=>'ImageObject','url'=>ARTICLES_SITE.'/brand/gold/mt-agency-logo.webp','width'=>600,'height'=>485]]];
        }
    }
    return compact('title','desc','canonical','image','noindex','alternates','graph');
}
function articlesDocument(array $data,string $kind,string $lang,string $root): string {
    $template=file_get_contents($root.'/dist/'.$lang.'/contact/index.html');
    $template=preg_replace('~\s*<title>.*?</title>~si','',$template);
    $template=preg_replace('~\s*<meta\s+(?:name|property)=["\'](?:description|robots|author|og:[^"\']+|twitter:[^"\']+)["\'][^>]*>~i','',$template);
    $template=preg_replace('~\s*<link\s+rel=["\'](?:canonical|alternate)["\'][^>]*>~i','',$template);
    $template=preg_replace('~\s*<script\s+type=["\']application/ld\+json["\'][^>]*>.*?</script>~si','',$template);
    $meta=articlesMeta($data,$kind,$lang);$title=str_contains($meta['title'],'Multi Task Agency')?$meta['title']:$meta['title'].' | Multi Task Agency';$head='<title>'.articlesEscape($title).'</title><meta name="description" content="'.articlesEscape($meta['desc']).'"><meta name="robots" content="'.($meta['noindex']?'noindex, follow':'index, follow').'">';
    if($kind!=='error')$head.='<link rel="canonical" href="'.articlesEscape($meta['canonical']).'">';
    foreach($meta['alternates'] as $locale=>$url)$head.='<link rel="alternate" hreflang="'.$locale.'-EG" href="'.articlesEscape(ARTICLES_SITE.$url).'">';
    $shareTitle=$data['article']['title']??$title;$shareDescription=$data['article']['excerpt']??$meta['desc'];
    $shareImage=$meta['image'];$isArticleMedia=preg_match('~^https://multitaskagency\.com/api/articles/media/([a-f0-9]{32})(?:\?[^#]*)?$~',$shareImage,$imageMatch)===1;
    if($isArticleMedia)$shareImage=ARTICLES_SITE.'/api/articles/media/'.$imageMatch[1].'?format=jpeg';
    $imageAlt=$data['article']['cover_alt']??$shareTitle;
    foreach(['type'=>$kind==='detail'?'article':'website','site_name'=>'Multi Task Agency','title'=>$shareTitle,'description'=>$shareDescription,'url'=>$meta['canonical'],'image'=>$shareImage,'image:secure_url'=>$shareImage,'image:alt'=>$imageAlt,'locale'=>$lang==='en'?'en_EG':'ar_EG'] as $key=>$value)$head.='<meta property="og:'.$key.'" content="'.articlesEscape($value).'">';
    if($isArticleMedia)$head.='<meta property="og:image:type" content="image/jpeg">';
    $head.='<meta name="twitter:card" content="summary_large_image">';
    foreach(['title'=>$shareTitle,'description'=>$shareDescription,'image'=>$shareImage,'image:alt'=>$imageAlt] as $key=>$value)$head.='<meta name="twitter:'.$key.'" content="'.articlesEscape($value).'">';
    if($kind==='detail')foreach(['published_time'=>'published_at','modified_time'=>'updated_at'] as $key=>$field)if(!empty($data['article'][$field]))$head.='<meta property="article:'.$key.'" content="'.articlesEscape($data['article'][$field]).'">';
    if($meta['graph'])$head.='<script type="application/ld+json">'.articlesJson(['@context'=>'https://schema.org','@graph'=>$meta['graph']]).'</script>';
    $manifest=json_decode(file_get_contents($root.'/dist/.vite/manifest.json'),true);$css=[];$seen=[];
    $visit=function($entry)use(&$visit,&$css,&$seen,$manifest){if(isset($seen[$entry]))return;$seen[$entry]=true;$c=$manifest[$entry]??[];foreach($c['css']??[] as $file)$css[$file]=true;foreach($c['imports']??[] as $dep)$visit($dep);};
    $visit('src/pages/ArticlesPage.jsx');$visit('src/pages/ArticlePage.jsx');
    foreach(array_keys($css) as $file)$head.='<link rel="stylesheet" href="/'.articlesEscape($file).'">';
    $html=str_replace('</head>',$head.'</head>',$template);
    $main=$kind==='error'?'<main id="main-content" class="public-page article-page"><div class="container"><h1>'.articlesEscape($lang==='en'?'Article not found':'المقال غير موجود').'</h1><p>'.articlesEscape($data['error']['message']).'</p><a href="/'.$lang.'/articles/">'.($lang==='en'?'All articles':'كل المقالات').'</a></div></main>':articlesRenderMain($data,$kind,$lang);
    $html=preg_replace('~<main\b[^>]*>.*?</main>~si',$main,$html,1);
    $target=$lang==='ar'?'en':'ar';$translation=$data['translations'][$target]??'/'.$target.'/articles/'.($kind==='detail'?'?translation=unavailable':'');
    $html=preg_replace('~(<a class="lang-btn" href=")[^"]*(")~','$1'.articlesEscape($translation).'$2',$html,1);
    $html=str_replace('nav-link active','nav-link',$html);
    $html=str_replace('class="nav-link" href="/'.$lang.'/articles/"','class="nav-link active" aria-current="page" href="/'.$lang.'/articles/"',$html);
    $boot=['path'=>(parse_url($_SERVER['REQUEST_URI']??'/',PHP_URL_PATH)?:'/').(!empty($_SERVER['QUERY_STRING'])?'?'.$_SERVER['QUERY_STRING']:''),'kind'=>$kind,'data'=>$data];
    return str_replace('</body>','<script id="articles-bootstrap" type="application/json">'.articlesJson($boot).'</script></body>',$html);
}
function articlesSitemap(ArticleStore $store,string $staticPath): string {
    $xml=file_get_contents($staticPath);if(!$store->ready())return $xml;
    $entries=[];$langs=[];
    foreach($store->publishedRows() as $r){
        $a=$store->publicArticle($r);$url=ARTICLES_SITE.'/'.$a['locale'].'/articles/'.rawurlencode($a['slug']).'/';$last=max($a['updated_at'],$a['published_at']);$langs[$a['locale']]=max($langs[$a['locale']]??'',$last);
        $entry='<url><loc>'.articlesEscape($url).'</loc><lastmod>'.articlesEscape($last).'</lastmod>';
        foreach($a['translations'] as $lang=>$link)$entry.='<xhtml:link rel="alternate" hreflang="'.$lang.'-EG" href="'.articlesEscape(ARTICLES_SITE.$link).'"/>';
        $entries[]=$entry.'</url>';
    }
    foreach($langs as $lang=>$last)$entries[]='<url><loc>'.ARTICLES_SITE.'/'.$lang.'/articles/</loc><lastmod>'.articlesEscape($last).'</lastmod></url>';
    return str_replace('</urlset>',implode("\n",$entries)."\n</urlset>",$xml);
}
