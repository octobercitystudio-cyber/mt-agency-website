<?php
declare(strict_types=1);

function articleShareIcon(string $platform): string {
    $paths=[
        'facebook'=>'<path d="M14 21v-8h3l.5-4H14V7c0-1.2.3-2 2-2h2V1.5a24 24 0 0 0-3-.2c-3 0-5 1.8-5 5.2V9H7v4h3v8z"/>',
        'whatsapp'=>'<path d="M20.5 3.5A11.9 11.9 0 0 0 12 0C5.4 0 0 5.4 0 12c0 2.1.5 4.1 1.6 6L0 24l6.2-1.6a12 12 0 0 0 5.8 1.5h.1c6.6 0 12-5.4 12-12 0-3.2-1.3-6.2-3.6-8.4ZM12.1 22a10 10 0 0 1-5.1-1.4l-.4-.2-3.7 1 1-3.6-.2-.4A10 10 0 1 1 12.1 22Zm5.5-7.5c-.3-.2-1.8-.9-2.1-1s-.5-.2-.7.2-.8 1-.9 1.2-.4.2-.7.1a8.2 8.2 0 0 1-2.5-1.6 9.4 9.4 0 0 1-1.7-2.1c-.2-.3 0-.5.1-.6l.5-.6.3-.5c.1-.2 0-.4 0-.6l-1-2.2c-.2-.6-.5-.5-.7-.5h-.6c-.2 0-.5.1-.8.4-.3.3-1 1-1 2.5s1.1 2.9 1.2 3.1c.2.2 2.2 3.4 5.2 4.7.7.3 1.3.5 1.8.6.7.2 1.4.2 1.9.1.6-.1 1.8-.7 2.1-1.4.3-.7.3-1.3.2-1.4-.1-.2-.3-.3-.6-.4Z"/>',
        'linkedin'=>'<circle cx="4.5" cy="4.5" r="2"/><path d="M3 8h3v13H3zm6 0h3v1.8c1-1.4 2.2-2.1 4-2.1 3.1 0 5 1.8 5 5.5V21h-3.5v-7.1c0-2-.7-3.1-2.3-3.1-1.8 0-2.7 1.2-2.7 3.5V21H9z"/>',
        'x'=>'<path d="M3 3h5.1l4.8 6.4L18.5 3H21l-7 8.2L22 21h-5.1l-5.5-7.2L5.2 21H2.7l7.4-8.8zm3.4 1.8L17.8 19.2h1.8L8.2 4.8z"/>',
    ];
    return '<svg viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">'.($paths[$platform]??'').'</svg>';
}

function articleViewShare(array $article, string $lang): string {
    $en=$lang==='en';$e='articleViewEscape';
    $url='https://multitaskagency.com'.articleViewPath($lang,(string)$article['slug']);
    $links=[
        ['key'=>'facebook','name'=>'Facebook','href'=>'https://www.facebook.com/sharer/sharer.php?u='.rawurlencode($url)],
        ['key'=>'whatsapp','name'=>'WhatsApp','href'=>'https://wa.me/?text='.rawurlencode($article['title']."\n".$url)],
        ['key'=>'linkedin','name'=>'LinkedIn','href'=>'https://www.linkedin.com/sharing/share-offsite/?url='.rawurlencode($url)],
        ['key'=>'x','name'=>'X','href'=>'https://x.com/intent/tweet?text='.rawurlencode($article['title']).'&url='.rawurlencode($url)],
    ];
    $label=$en?'Share this article':'شارك المقال';
    $html='<section class="article-share" aria-label="'.$label.'"><div class="article-share__heading"><h2>'.$label.'</h2></div><div class="article-share__platforms">';
    foreach($links as $link) {
        $ariaLabel=$en?'Share on '.$link['name'].' (opens in a new tab)':'مشاركة عبر '.$link['name'].' (يفتح في نافذة جديدة)';
        $html.='<a class="article-share__platform" href="'.$e($link['href']).'" target="_blank" rel="noopener noreferrer" aria-label="'.$e($ariaLabel).'">'.articleShareIcon($link['key']).'<span dir="ltr">'.$link['name'].'</span></a>';
    }
    return $html.'</div></section>';
}
