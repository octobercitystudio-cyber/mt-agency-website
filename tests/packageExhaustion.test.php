<?php
declare(strict_types=1);
$source=file_get_contents(__DIR__.'/../api/index.php');
foreach(['authoritativePackageMinutes','effectiveSoldPackageStatus'] as $name){
    if(!preg_match('/^function '.preg_quote($name,'/').'\b.*?^\}/ms',$source,$match))throw new RuntimeException('Missing '.$name);
    eval($match[0]);
}
$fixtures=json_decode(file_get_contents(__DIR__.'/fixtures/packageExhaustion.json'),true,512,JSON_THROW_ON_ERROR);
foreach($fixtures as $fixture){
    $package=array_replace(['status'=>'active','expires_at'=>'2026-11-01'],$fixture['package']);
    if(effectiveSoldPackageStatus($package,'2026-10-06')!==$fixture['expected'])throw new RuntimeException($fixture['name']);
}
if(!str_contains($source,'$effectiveStatus=effectiveSoldPackageStatus($package,$today);'))throw new RuntimeException('Package statement must use the shared status');
echo 'Package exhaustion: '.count($fixtures)." shared status cases passed\n";
