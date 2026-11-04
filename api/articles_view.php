<?php
declare(strict_types=1);

/** Public article markup. All editorial strings are escaped; no raw HTML is accepted. */
function articleViewEscape(mixed $value): string {
    return htmlspecialchars((string)($value ?? ''), ENT_QUOTES | ENT_SUBSTITUTE, 'UTF-8');
}
function articleViewPath(string $lang, string $slug = ''): string {
    return '/'.($lang === 'en' ? 'en' : 'ar').'/articles/'.($slug !== '' ? rawurlencode($slug).'/' : '');
}
function articleViewListPath(string $lang, array $query = []): string {
    $query = array_filter($query, fn($value, $key) => $value !== '' && $value !== null && !($key === 'page' && (int)$value <= 1), ARRAY_FILTER_USE_BOTH);
    return articleViewPath($lang).($query ? '?'.http_build_query($query, '', '&', PHP_QUERY_RFC3986) : '');
}
function articleViewDate(?string $value, string $lang): string {
    if (!$value) return '';
    try {
        $date = (new DateTimeImmutable($value))->setTimezone(new DateTimeZone('Africa/Cairo'));
        if ($lang === 'en') return $date->format('j F Y');
        $months = ['يناير','فبراير','مارس','أبريل','مايو','يونيو','يوليو','أغسطس','سبتمبر','أكتوبر','نوفمبر','ديسمبر'];
        return $date->format('j').' '.$months[(int)$date->format('n') - 1].' '.$date->format('Y');
    } catch (Throwable) { return ''; }
}
function articleViewUrl(mixed $value): string {
    $url = (string)$value;
    if (preg_match('~^/(?!/)[^\x00-\x20\\\\]*$~', $url)) return $url;
    if (filter_var($url, FILTER_VALIDATE_URL) && strtolower((string)parse_url($url, PHP_URL_SCHEME)) === 'https') return $url;
    return '';
}
function articleViewVideo(string $url): ?array {
    $parts = parse_url($url);
    if (!$parts) return null;
    $host = strtolower($parts['host'] ?? 'multitaskagency.com');
    $path = $parts['path'] ?? '';
    if (isset($parts['scheme']) && $parts['scheme'] !== 'https') return null;
    if (in_array($host, ['youtube.com', 'www.youtube.com', 'youtu.be'], true)) {
        parse_str($parts['query'] ?? '', $query);
        $id = $host === 'youtu.be' ? substr($path, 1) : ($query['v'] ?? (preg_match('~^/embed/([^/]+)$~', $path, $m) ? $m[1] : ''));
        return is_string($id) && preg_match('/^[\w-]{11}$/', $id) ? ['type'=>'youtube','url'=>'https://www.youtube.com/embed/'.$id.'?playsinline=1'] : null;
    }
    return $host === 'multitaskagency.com' && preg_match('~^/api/articles/media/[^/]+$~', $path) ? ['type'=>'file','url'=>$path.(isset($parts['query'])?'?'.$parts['query']:'')] : null;
}
function articleViewContent(array $blocks, string $lang): string {
    $e = 'articleViewEscape';
    ob_start(); ?>
    <div class="article-prose">
    <?php foreach ($blocks as $index=>$block): $type=$block['type']??'';
        if ($type==='heading'): $tag=(int)($block['level']??2)===3?'h3':'h2'; ?>
            <<?=$tag?> id="section-<?=$index+1?>" tabindex="-1"><?=$e($block['text']??'')?></<?=$tag?>>
        <?php elseif($type==='paragraph'): ?><p><?=$e($block['text']??'')?></p>
        <?php elseif($type==='quote'): ?><blockquote><p><?=$e($block['text']??'')?></p></blockquote>
        <?php elseif($type==='list'): $tag=!empty($block['ordered'])?'ol':'ul'; ?><<?=$tag?>><?php foreach(($block['items']??[]) as $item): ?><li><?=$e($item)?></li><?php endforeach ?></<?=$tag?>>
        <?php elseif($type==='link' && ($url=articleViewUrl($block['url']??''))): ?><p><a href="<?=$e($url)?>" rel="noopener noreferrer"><?=$e($block['text']??$url)?></a></p>
        <?php elseif($type==='image' && ($url=articleViewUrl($block['url']??''))): ?><figure><img src="<?=$e($url)?>" alt="<?=$e($block['alt']??'')?>" width="<?=max(1,(int)($block['width']??1200))?>" height="<?=max(1,(int)($block['height']??675))?>" loading="lazy" decoding="async"><?php if(!empty($block['caption'])): ?><figcaption><?=$e($block['caption'])?></figcaption><?php endif ?></figure>
        <?php elseif($type==='video' && ($video=articleViewVideo((string)($block['url']??'')))): ?><figure class="article-video"><?php if($video['type']==='youtube'): ?><iframe src="<?=$e($video['url'])?>" title="<?=$e($block['caption']??($lang==='en'?'Article video':'فيديو المقال'))?>" loading="lazy" referrerpolicy="strict-origin-when-cross-origin" allow="accelerometer; encrypted-media; gyroscope; picture-in-picture" allowfullscreen></iframe><?php else: ?><video src="<?=$e($video['url'])?>" controls preload="none" playsinline></video><?php endif ?><figcaption><?=$e($block['caption']??'')?></figcaption></figure>
        <?php elseif($type==='table' && !empty($block['rows'])): ?><div class="article-table-scroll" role="region" tabindex="0" aria-label="<?=$lang==='en'?'Article table, scroll horizontally if needed':'جدول المقال، يمكن التمرير أفقيًا عند الحاجة'?>"><table><thead><tr><?php foreach($block['rows'][0] as $cell): ?><th scope="col"><?=$e($cell)?></th><?php endforeach ?></tr></thead><tbody><?php foreach(array_slice($block['rows'],1) as $row): ?><tr><?php foreach($row as $cell): ?><td><?=$e($cell)?></td><?php endforeach ?></tr><?php endforeach ?></tbody></table></div>
        <?php endif; endforeach ?>
    </div>
    <?php return (string)ob_get_clean();
}
function articleViewCard(array $article, string $lang, bool $featured=false): string {
    $e='articleViewEscape'; $en=$lang==='en'; $path=articleViewPath($lang,(string)$article['slug']); $category=$article['category'][$en?'name_en':'name_ar']??'';
    ob_start(); ?>
    <article class="article-card<?=$featured?' article-card--featured':''?>">
        <?php if(!empty($article['cover_url'])): ?><a class="article-card__media" href="<?=$e($path)?>" tabindex="-1" aria-hidden="true"><img src="<?=$e(articleViewUrl($article['cover_url']))?>" alt="" width="1200" height="675" loading="<?=$featured?'eager':'lazy'?>" decoding="async"></a><?php endif ?>
        <div class="article-card__copy"><div class="article-card__kicker"><?php if($featured): ?><span><?=$en?'Editor’s pick':'اختيار التحرير'?></span><?php endif ?><?php if($category!==''): ?><span><?=$e($category)?></span><?php endif ?></div>
            <h2><a href="<?=$e($path)?>"><?=$e($article['title'])?></a></h2><p><?=$e($article['excerpt']??'')?></p>
            <div class="article-card__footer"><span><time datetime="<?=$e($article['published_at']??'')?>"><?=$e(articleViewDate($article['published_at']??null,$lang))?></time><?php if(!empty($article['reading_minutes'])): ?> · <?=(int)$article['reading_minutes']?> <?=$en?'min read':'دقائق قراءة'?><?php endif ?></span><a href="<?=$e($path)?>" aria-label="<?=$e(($en?'Read: ':'اقرأ: ').$article['title'])?>"><span aria-hidden="true"><?=$en?'↗':'↖'?></span></a></div>
        </div>
    </article>
    <?php return (string)ob_get_clean();
}
function articleViewCta(string $lang, ?string $service=null): string {
    $en=$lang==='en';$e='articleViewEscape';
    ob_start(); ?>
    <aside class="articles-contact"><div><span class="articles-eyebrow"><?=$en?'YOUR NEXT PROJECT':'مشروعك القادم'?></span><h2><?=$en?'Have a project in mind?':'عندك مشروع في بالك؟'?></h2><p><?=$en?'Tell us what you need, and we’ll discuss the right scope together.':'احكِ لنا احتياجك، ونناقش معك نطاق العمل المناسب.'?></p></div><div class="article-cta-links"><?php if($service): ?><a class="article-service-link" href="/<?=$lang?>/services/<?=$e(rawurlencode($service))?>/"><?=$en?'Explore the related service':'تعرّف على الخدمة المرتبطة'?></a><?php endif ?><a class="article-button article-button--light" href="/<?=$lang?>/contact/"><?=$en?'Request a quote':'اطلب عرض سعر'?> <span aria-hidden="true"><?=$en?'→':'←'?></span></a></div></aside>
    <?php return (string)ob_get_clean();
}
function articlesRenderMain(array $data, string $kind, string $lang): string {
    $lang=$lang==='en'?'en':'ar';$en=$lang==='en';$e='articleViewEscape';
    $article=$data['article']??null;
    ob_start(); ?>
    <main id="main-content" class="public-page articles-page<?=$kind==='detail'?' article-detail':''?>" lang="<?=$lang?>" dir="<?=$en?'ltr':'rtl'?>"><div class="articles-container">
    <nav class="article-breadcrumb" aria-label="<?=$en?'Breadcrumb':'مسار التنقل'?>"><a href="/<?=$lang?>/"><?=$en?'Home':'الرئيسية'?></a><span aria-hidden="true">/</span><?php if($article): ?><a href="<?=articleViewPath($lang)?>"><?=$en?'Articles':'المقالات'?></a><span aria-hidden="true">/</span><span aria-current="page"><?=$e($article['title'])?></span><?php else: ?><span><?=$en?'Articles':'المقالات'?></span><?php endif ?></nav>
    <?php if($kind==='detail' && $article):
        $category=$article['category'][$en?'name_en':'name_ar']??'';
        $headings=[];foreach($article['blocks']??[] as $index=>$block)if(($block['type']??'')==='heading')$headings[]=['id'=>'section-'.($index+1),'text'=>$block['text'],'level'=>$block['level']??2]; ?>
        <article><header class="article-heading"><div class="article-card__kicker"><?php if($category): ?><a href="<?=$e(articleViewListPath($lang,['category'=>$article['category']['slug']]))?>"><?=$e($category)?></a><?php endif ?><span><?=$en?'PRACTICAL GUIDE':'دليل عملي'?></span></div><h1><?=$e($article['title'])?></h1><p class="article-lede"><?=$e($article['excerpt']??'')?></p><div class="article-byline"><span><?=$e($article['author_name']??'Multi Task Agency')?></span><span><?=$en?'Published':'نُشر في'?> <time datetime="<?=$e($article['published_at']??'')?>"><?=$e(articleViewDate($article['published_at']??null,$lang))?></time></span><?php if(!empty($article['updated_at']) && strtotime($article['updated_at'])>strtotime($article['published_at']??'now')+60): ?><span><?=$en?'Updated':'آخر تحديث'?> <time datetime="<?=$e($article['updated_at'])?>"><?=$e(articleViewDate($article['updated_at'],$lang))?></time></span><?php endif ?><?php if(!empty($article['reading_minutes'])): ?><span><?=(int)$article['reading_minutes']?> <?=$en?'min read':'دقائق قراءة'?></span><?php endif ?></div></header>
        <?php if(!empty($article['cover_url'])): ?><figure class="article-cover"><img src="<?=$e(articleViewUrl($article['cover_url']))?>" alt="<?=$e($article['cover_alt']??'')?>" width="1600" height="900" fetchpriority="high" decoding="async"></figure><?php endif ?>
        <div class="article-reading-layout<?=count($headings)<3?' article-reading-layout--simple':''?>"><?php if(count($headings)>=3): ?><nav class="article-toc" aria-label="<?=$en?'On this page':'محتويات المقال'?>"><h2><?=$en?'On this page':'في هذا المقال'?></h2><ol><?php foreach($headings as $heading): ?><li<?=((int)$heading['level']===3?' class="article-toc__sub"':'')?>><a href="#<?=$e($heading['id'])?>"><?=$e($heading['text'])?></a></li><?php endforeach ?></ol></nav><?php endif ?><div class="article-reading-column"><?=articleViewContent($article['blocks']??[],$lang)?><section class="article-share" aria-label="<?=$en?'Share this article':'مشاركة المقال'?>"><strong><?=$en?'Useful? Share it.':'مفيد؟ شاركه.'?></strong><?php $shareUrl='https://multitaskagency.com'.articleViewPath($lang,(string)$article['slug']); ?><a href="https://wa.me/?text=<?=rawurlencode($article['title']."\n".$shareUrl)?>" target="_blank" rel="noopener noreferrer">WhatsApp</a><a href="https://www.facebook.com/sharer/sharer.php?u=<?=rawurlencode($shareUrl)?>" target="_blank" rel="noopener noreferrer">Facebook</a></section></div></div></article>
        <?=articleViewCta($lang,$article['service_slug']??null)?>
        <?php if(!empty($data['related'])): ?><section class="articles-related"><div class="articles-results__heading"><h2><?=$en?'Continue reading':'اقرأ أيضًا'?></h2><a href="<?=articleViewPath($lang)?>"><?=$en?'All articles':'جميع المقالات'?></a></div><div class="articles-grid"><?php foreach($data['related'] as $related)echo articleViewCard($related,$lang); ?></div></section><?php endif ?>
    <?php elseif($kind==='list'):
        $q=(string)($_GET['q']??'');$category=(string)($_GET['category']??'');$page=max(1,(int)($data['page']??1));$total=(int)($data['total']??0);$pages=(int)($data['pages']??1);
        $featured=(!$q&&!$category&&$page===1)?($data['featured']??null):null;
        $sectionTitle=$q?($en?'Search results':'نتائج البحث'):($en?'From the editorial desk':'من مكتبة المعرفة');
        if(!$q&&$category)foreach($data['categories']??[] as $item)if($item['slug']===$category)$sectionTitle=$item[$en?'name_en':'name_ar']; ?>
        <header class="articles-intro"><span class="articles-eyebrow">MULTI TASK AGENCY · <?=$en?'KNOWLEDGE':'المعرفة'?></span><div><h1><?=$en?'Articles':'المقالات'?></h1></div></header>
        <?php if(($_GET['translation']??'')==='unavailable'): ?><p class="articles-notice" role="status"><?=$en?'This article is not available in English yet. Explore our English articles below.':'هذا المقال غير متاح بالعربية حاليًا. يمكنك تصفّح المقالات العربية هنا.'?></p><?php endif ?>
        <section class="articles-discovery" aria-label="<?=$en?'Find an article':'ابحث عن مقال'?>"><form action="<?=articleViewPath($lang)?>" method="get" class="articles-search" role="search"><label for="article-search"><?=$en?'What would you like to know?':'عن ماذا تريد أن تعرف؟'?></label><div><input id="article-search" name="q" type="search" maxlength="120" value="<?=$e($q)?>" placeholder="<?=$en?'Search articles…':'ابحث في المقالات…'?>"><?php if($category): ?><input type="hidden" name="category" value="<?=$e($category)?>"><?php endif ?><button type="submit"><?=$en?'Search':'بحث'?></button></div></form><nav class="articles-categories" aria-label="<?=$en?'Article categories':'تصنيفات المقالات'?>"><a href="<?=$e(articleViewListPath($lang,['q'=>$q]))?>"<?=$category===''?' aria-current="page"':''?>><?=$en?'All topics':'كل الموضوعات'?></a><?php foreach($data['categories']??[] as $item): ?><a href="<?=$e(articleViewListPath($lang,['q'=>$q,'category'=>$item['slug']]))?>"<?=$category===$item['slug']?' aria-current="page"':''?>><?=$e($item[$en?'name_en':'name_ar'])?></a><?php endforeach ?></nav></section>
        <?php if($total===0): ?><div class="articles-state"><h2><?=$q||$category?($en?'No articles match your search':'لا توجد مقالات مطابقة للبحث'):($en?'Our library is taking shape':'مكتبتنا قيد الإعداد')?></h2><p><?=$q||$category?($en?'Try another keyword or explore all topics.':'جرّب كلمة أخرى أو تصفّح كل الموضوعات.'):($en?'We’re preparing practical guides for your next project. You can explore our services in the meantime.':'نجهّز أدلة عملية لمشروعك القادم. يمكنك استكشاف خدماتنا في الوقت الحالي.')?></p><a class="article-button" href="<?=$q||$category?articleViewPath($lang):'/'.$lang.'/services/'?>"><?=$q||$category?($en?'Show all articles':'عرض جميع المقالات'):($en?'Explore our services':'استكشف خدماتنا')?></a></div>
        <?php else: ?><section class="articles-results" aria-label="<?=$en?'Articles':'المقالات'?>"><div class="articles-results__heading"><h2><?=$e($sectionTitle)?></h2><span><?=$total?> <?=$en?'articles':'مقال'?></span></div><?php if($featured)echo articleViewCard($featured,$lang,true); ?><div class="articles-grid"><?php foreach($data['items']??[] as $item)if(!$featured||(int)$featured['id']!==(int)$item['id'])echo articleViewCard($item,$lang); ?></div></section><?php endif ?>
        <?php if($pages>1): ?><nav class="articles-pagination" aria-label="<?=$en?'Article pages':'صفحات المقالات'?>"><?php if($page>1): ?><a rel="prev" href="<?=$e(articleViewListPath($lang,['q'=>$q,'category'=>$category,'page'=>$page-1]))?>"><?=$en?'Previous':'السابق'?></a><?php endif ?><?php $previous=0;for($number=1;$number<=$pages;$number++): if($number!==1&&$number!==$pages&&abs($number-$page)>2)continue;if($previous&&$number-$previous>1): ?><span>…</span><?php endif;$previous=$number;?><a href="<?=$e(articleViewListPath($lang,['q'=>$q,'category'=>$category,'page'=>$number]))?>"<?=$number===$page?' aria-current="page"':''?> aria-label="<?=$en?'Page':'صفحة'?> <?=$number?>"><?=$number?></a><?php endfor ?><?php if($page<$pages): ?><a rel="next" href="<?=$e(articleViewListPath($lang,['q'=>$q,'category'=>$category,'page'=>$page+1]))?>"><?=$en?'Next':'التالي'?></a><?php endif ?></nav><?php endif ?>
        <?=articleViewCta($lang)?>
    <?php else: ?><div class="articles-state"><h1><?=$en?'Article not found':'المقال غير موجود'?></h1><p><?=$en?'Explore our library to find another guide.':'يمكنك تصفّح مكتبة المقالات للعثور على دليل آخر.'?></p><a class="article-button" href="<?=articleViewPath($lang)?>"><?=$en?'All articles':'جميع المقالات'?></a></div><?php endif ?>
    </div></main>
    <?php return (string)ob_get_clean();
}
