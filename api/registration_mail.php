<?php
declare(strict_types=1);

function registrationMailSettings(array $config): array {
    $mail = is_array($config['registration_mail'] ?? null) ? $config['registration_mail'] : [];
    $password = (string)($mail['password'] ?? '');
    if ($password === '' && !empty($mail['password_env'])) $password = (string)(getenv((string)$mail['password_env']) ?: '');
    return array_replace($mail,['password'=>$password]) + ['enabled'=>false,'host'=>'','port'=>465,'encryption'=>'ssl','username'=>'','password'=>$password,'from_address'=>'','from_name'=>'Multi Task Agency'];
}

function registrationMailerReady(array $config): bool {
    $mail = registrationMailSettings($config);
    return !empty($mail['enabled']) && filter_var($mail['from_address'],FILTER_VALIDATE_EMAIL) !== false
        && trim((string)$mail['host']) !== '' && trim((string)$mail['username']) !== '' && $mail['password'] !== ''
        && in_array((string)$mail['encryption'],['ssl','tls'],true) && in_array((int)$mail['port'],[465,587],true);
}

function sendRegistrationEmailCode(array $config, string $email, string $code): void {
    if (!registrationMailerReady($config)) fail('تأكيد البريد غير متاح مؤقتًا. تواصل مع الشركة أو حاول لاحقًا.',503,'email_not_configured');
    require_once __DIR__.'/vendor/phpmailer/Exception.php';
    require_once __DIR__.'/vendor/phpmailer/PHPMailer.php';
    require_once __DIR__.'/vendor/phpmailer/SMTP.php';
    $settings = registrationMailSettings($config);
    $mailer = new \PHPMailer\PHPMailer\PHPMailer(true);
    $mailer->isSMTP();
    $mailer->SMTPDebug = 0;
    $mailer->Timeout = 20;
    $mailer->Host = (string)$settings['host'];
    $mailer->Port = (int)$settings['port'];
    $mailer->SMTPAuth = true;
    $mailer->Username = (string)$settings['username'];
    $mailer->Password = (string)$settings['password'];
    $mailer->SMTPSecure = (string)$settings['encryption'];
    $mailer->CharSet = 'UTF-8';
    $mailer->setFrom((string)$settings['from_address'],(string)$settings['from_name']);
    $mailer->addAddress($email);
    $mailer->Subject = 'رمز تأكيد بريدك لدى Multi Task Agency';
    $mailer->Body = "مرحبًا بك لدى Multi Task Agency،\n\nرمز تأكيد بريدك الإلكتروني: {$code}\n\nالرمز صالح لمدة 10 دقائق ويستخدم مرة واحدة لاستكمال إنشاء حسابك.\nإذا لم تطلب التسجيل، يمكنك تجاهل هذه الرسالة.\n\nMulti Task Agency";
    $mailer->send();
}
