<?php
declare(strict_types=1);

function articleCtaCopy(string $service, string $lang): array {
    $en=$lang==='en';
    if($service==='social-media-management') return [
        'question'=>$en?'Want to strengthen your digital presence and create more sales opportunities?':'هل تريد تعزيز حضور شركتك الرقمي وزيادة فرص البيع؟',
        'contactLabel'=>$en?'Discuss your digital presence':'ناقش حضورك الرقمي معنا',
        'serviceLabel'=>$en?'Social media management':'خدمة إدارة السوشيال ميديا',
    ];
    if($service==='commercial-video-production') return [
        'question'=>$en?'Want an ad that reflects the quality of your company or product?':'هل تريد إعلانًا يعكس جودة شركتك أو منتجك؟',
        'contactLabel'=>$en?'Discuss your ad idea':'ناقش فكرة إعلانك معنا',
        'serviceLabel'=>$en?'Advertising video production':'خدمة تصوير الإعلانات',
    ];
    return [
        'question'=>$en?'Ready to start your project?':'جاهز نبدأ مشروعك؟',
        'contactLabel'=>$en?'Discuss your project':'ناقش مشروعك معنا',
        'serviceLabel'=>$en?'Explore the related service':'تعرّف على الخدمة',
    ];
}

function articleCtaDestination(array $block, string $lang): ?array {
    if(($block['type']??'')!=='link' || !($href=articleViewUrl($block['url']??''))) return null;
    $url=parse_url($href);
    if(!$url || (isset($url['host']) && ($url['host']!=='multitaskagency.com' || ($url['scheme']??'')!=='https' || isset($url['user']) || isset($url['pass']) || (isset($url['port']) && $url['port']!==443)))) return null;
    $path=$url['path']??'';
    if($path==='/'.$lang.'/contact/' || $path==='/'.$lang.'/contact') return ['kind'=>'contact','href'=>$href];
    if(preg_match('~^/'.preg_quote($lang,'~').'/services/([a-z0-9-]+)/?$~',$path,$match)) return ['kind'=>'service','href'=>$href,'service'=>$match[1]];
    return null;
}

/** Match only the last consecutive service/contact pair; keep reference links intact. */
function articleClosingCta(array $blocks, string $lang): ?array {
    $end=-1;
    foreach($blocks as $index=>$block) if(($block['type']??'')==='link') $end=$index;
    if($end<1) return null;
    foreach(array_slice($blocks,$end+1) as $block) if(($block['type']??'')!=='paragraph') return null;
    $contact=null;$service=null;
    foreach([articleCtaDestination($blocks[$end-1],$lang),articleCtaDestination($blocks[$end],$lang)] as $link) {
        if(($link['kind']??'')==='contact') $contact=$link;
        if(($link['kind']??'')==='service') $service=$link;
    }
    if(!$contact || !$service) return null;
    return ['start'=>$end-1,'end'=>$end,'contactHref'=>$contact['href'],'serviceHref'=>$service['href'],'service'=>$service['service']];
}

function articleEndingCta(string $lang, string $service='', ?string $contactHref=null, ?string $serviceHref=null): string {
    $en=$lang==='en';$e='articleViewEscape';$copy=articleCtaCopy($service,$lang);
    $contactHref=$contactHref??'/'.$lang.'/contact/';
    $serviceHref=$serviceHref??($service!==''?'/'.$lang.'/services/'.rawurlencode($service).'/':'');
    $arrow='<svg width="19" height="19" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="'.($en?'M5 12h14m-7-7 7 7-7 7':'M19 12H5m7 7-7-7 7-7').'"/></svg>';
    return '<aside class="article-ending-cta" aria-label="'.$e($copy['question']).'"><span class="article-ending-cta__eyebrow">'.($en?'LET’S TALK ABOUT YOUR PROJECT':'خلّينا نتكلم عن مشروعك').'</span><h2>'.$e($copy['question']).'</h2><div class="article-ending-cta__actions"><a class="article-ending-cta__button article-ending-cta__button--primary" href="'.$e($contactHref).'">'.$e($copy['contactLabel']).$arrow.'</a>'.($serviceHref!==''?'<a class="article-ending-cta__button article-ending-cta__button--secondary" href="'.$e($serviceHref).'">'.$e($copy['serviceLabel']).$arrow.'</a>':'').'</div></aside>';
}
