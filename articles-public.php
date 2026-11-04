<?php
declare(strict_types=1);
// Public HTML controller. Apache only rewrites article URLs/sitemap here;
// direct requests to this source file remain denied by the root file rules.
require_once __DIR__.'/api/articles.php';
require_once __DIR__.'/api/articles_view.php';
require_once __DIR__.'/api/articles_seo.php';
header('X-Content-Type-Options: nosniff');
header('Cache-Control: no-cache, must-revalidate, max-age=0');
header('Content-Type: text/html; charset=utf-8');
$path=(string)(parse_url($_SERVER['REQUEST_URI']??'/',PHP_URL_PATH)?:'/');
$lang=preg_match('~^/(ar|en)/~',$path,$lm)?$lm[1]:'ar';
try {
    $config=require __DIR__.'/api/config.php';
    $d=$config['db'];$pdo=new PDO(sprintf('mysql:host=%s;port=%d;dbname=%s;charset=utf8mb4',$d['host'],$d['port']??3306,$d['name']),$d['user'],$d['password'],[PDO::ATTR_ERRMODE=>PDO::ERRMODE_EXCEPTION,PDO::ATTR_DEFAULT_FETCH_MODE=>PDO::FETCH_ASSOC,PDO::ATTR_EMULATE_PREPARES=>false]);
    $store=new ArticleStore($pdo,(int)($config['articles']['organization_id']??$config['registration']['organization_id']??1),__DIR__);
    if($path==='/sitemap.xml'){
        header('Content-Type: application/xml; charset=utf-8');
        echo articlesSitemap($store,__DIR__.'/dist/sitemap.xml');exit;
    }
    $store->requireReady();
    if(!preg_match('~^/(ar|en)/articles(?:/([^/]+))?/$~',$path,$m))throw new ArticleError('not_found','الصفحة غير موجودة.',404);
    $kind=empty($m[2])?'list':'detail';
    $data=$kind==='list'?$store->listing($lang,$_GET):$store->detail($lang,rawurldecode($m[2]));
    if(isset($data['redirect'])){header('Location: '.$data['redirect'],true,301);exit;}
    echo articlesDocument($data,$kind,$lang,__DIR__);
}catch(ArticleError $e){http_response_code($e->status);header('X-Robots-Tag: noindex, follow');echo articlesDocument(['error'=>['code'=>$e->errorCode,'message'=>$lang==='en'?($e->status===404?'This article is not available.':'Articles are temporarily unavailable.'):$e->getMessage()]],'error',$lang,__DIR__);}
catch(Throwable $e){error_log('[Articles public] '.$e->getMessage());http_response_code(503);header('Retry-After: 300');header('X-Robots-Tag: noindex, follow');echo '<!doctype html><html lang="'.$lang.'" dir="'.($lang==='ar'?'rtl':'ltr').'"><head><meta charset="utf-8"><meta name="robots" content="noindex, follow"><title>Multi Task Agency</title></head><body><main><h1>'.($lang==='ar'?'المقالات غير متاحة مؤقتًا':'Articles are temporarily unavailable').'</h1><a href="/'.$lang.'/">'.($lang==='ar'?'العودة للرئيسية':'Return home').'</a></main></body></html>';}
