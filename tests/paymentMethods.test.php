<?php
declare(strict_types=1);
require __DIR__.'/../api/payment_methods.php';
function fail(string $message,int $status=400,string $code='error'):never{throw new RuntimeException($code);}
foreach(['cash'=>'cash','كاش'=>'cash','نقدي'=>'cash','instapay'=>'instapay','إنستاباي'=>'instapay','انستاباي'=>'instapay','vodafone_cash'=>'vodafone_cash','فودافون كاش'=>'vodafone_cash'] as $input=>$expected){if(requirePaymentMethod($input)!==$expected)throw new LogicException('Incorrect payment wallet');}
foreach(['bank_transfer','تحويل بنكي','بطاقة','شيك','',null,[]] as $invalid){try{requirePaymentMethod($invalid);throw new LogicException('Unsupported method accepted');}catch(RuntimeException $expected){if($expected->getMessage()!=='invalid_payment_method')throw $expected;}}
echo "PASS payment methods accept three wallets and reject unsupported new methods.\n";

if(requireClientTransferMethod('vodafone_cash')!=='vodafone_cash')throw new LogicException('Vodafone transfer rejected');
foreach(['cash','instapay','bank_transfer','',null,[]] as $invalid){try{requireClientTransferMethod($invalid);throw new LogicException('Unsupported customer transfer accepted');}catch(RuntimeException $expected){if($expected->getMessage()!=='invalid_payment_method')throw $expected;}}
echo "PASS new customer transfers accept Vodafone Cash only; historical wallet labels remain intact.\n";
