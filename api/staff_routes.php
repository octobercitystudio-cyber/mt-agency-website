<?php
declare(strict_types=1);
function staffPortalPath(string $suffix = ''): string {
    static $base;
    if ($base === null) {
        $config=json_decode(file_get_contents(__DIR__.'/../staff-portal.json'),true,512,JSON_THROW_ON_ERROR);
        $base=$config['path']??'';
        if (!preg_match('#^/p-[a-f0-9]{16}$#D',$base)) throw new RuntimeException('Invalid staff portal path');
    }
    return $base.$suffix;
}
