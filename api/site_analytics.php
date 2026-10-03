<?php
declare(strict_types=1);

function analyticsEventNames(): array {
    return json_decode(file_get_contents(__DIR__.'/site_analytics_events.json'),true,512,JSON_THROW_ON_ERROR);
}
function analyticsScreens(): array {
    return ['home','schedule','packages','finance','offers','videos','security','requests','projects','history','book-studio','package-guide'];
}
function analyticsValidPage(string $path): bool {
    return (bool)preg_match('#^(?:/|/login|/register|/dashboard|/(?:ar|en)(?:/(?:about|portfolio|studios|contact|services(?:/[a-z0-9-]{1,80})?))?/?|/(?:about|portfolio|studios|contact|services(?:/[a-z0-9-]{1,80})?)/?)$#D',$path);
}
function analyticsSchema(PDO $pdo): void {
    if($pdo->getAttribute(PDO::ATTR_DRIVER_NAME)==='sqlite') {
        $pdo->exec('CREATE TABLE IF NOT EXISTS site_analytics_events (event_id TEXT PRIMARY KEY, organization_id INTEGER NOT NULL, visitor_key TEXT NOT NULL, session_key TEXT NOT NULL, event_name TEXT NOT NULL, page_path TEXT NOT NULL, screen TEXT NOT NULL, control TEXT NOT NULL, platform TEXT NOT NULL, device TEXT NOT NULL, source TEXT NOT NULL, created_at TEXT NOT NULL)');
        $pdo->exec('CREATE INDEX IF NOT EXISTS idx_analytics_org_date ON site_analytics_events(organization_id,created_at)');
        return;
    }
    $pdo->exec(file_get_contents(__DIR__.'/../database/mysql/051_site_analytics.sql'));
}
function analyticsNormalizeBatch(array $payload, ?DateTimeImmutable $now=null): array {
    $now ??= new DateTimeImmutable('now',new DateTimeZone('Africa/Cairo'));
    $items=$payload['events']??null;
    if(!is_array($items)||!array_is_list($items)||count($items)<1||count($items)>20)fail('دفعة الإحصائيات غير صحيحة.',422,'invalid_analytics_batch');
    $result=[];$known=analyticsEventNames();
    foreach($items as $item){
        if(!is_array($item))fail('حدث غير صحيح.',422,'invalid_analytics_event');
        foreach(['id','visitor','session'] as $field)if(!is_string($item[$field]??null)||!preg_match('/^[a-f0-9-]{36}$/D',$item[$field]))fail('معرف الحدث غير صحيح.',422,'invalid_analytics_id');
        $event=$item['event']??'';$page=$item['page']??'';$screen=$item['screen']??'';$control=$item['control']??'';
        if(!is_string($event)||!in_array($event,$known,true)||!is_string($page)||!analyticsValidPage($page))fail('نوع الحدث أو الصفحة غير صحيح.',422,'invalid_analytics_event');
        $page=rtrim($page,'/')?:'/';
        if(!is_string($screen)||($screen!==''&&!in_array($screen,analyticsScreens(),true))||($page!=='/dashboard'&&$screen!==''))fail('صفحة حساب العميل غير صحيحة.',422,'invalid_analytics_screen');
        if(!is_string($control)||!in_array($control,['','button','link','select','checkbox','file','submit'],true))fail('إجراء غير صحيح.',422,'invalid_analytics_control');
        foreach(['platform'=>['web','android_app','standalone'],'device'=>['mobile','desktop','tablet'],'source'=>['direct','facebook','instagram','google','search','referral','app']] as $field=>$allowed)if(!in_array($item[$field]??null,$allowed,true))fail('تصنيف الزيارة غير صحيح.',422,'invalid_analytics_dimension');
        $timestamp=$item['at']??null;
        if(!is_numeric($timestamp)||$timestamp<($now->getTimestamp()-86400)*1000||$timestamp>($now->getTimestamp()+300)*1000)fail('توقيت الحدث غير صحيح.',422,'invalid_analytics_time');
        $date=$now->setTimestamp((int)floor((float)$timestamp/1000))->format('Y-m-d H:i:s');
        $result[]=['event_id'=>$item['id'],'visitor_key'=>hash('sha256',$item['visitor']),'session_key'=>hash('sha256',$item['session']),'event_name'=>$event,'page_path'=>$page,'screen'=>$screen,'control'=>$control,'platform'=>$item['platform'],'device'=>$item['device'],'source'=>$item['source'],'created_at'=>$date];
    }
    return $result;
}
function analyticsInsert(PDO $pdo,int $org,array $events): int {
    $prefix=$pdo->getAttribute(PDO::ATTR_DRIVER_NAME)==='sqlite'?'INSERT OR IGNORE':'INSERT IGNORE';
    $statement=$pdo->prepare("$prefix INTO site_analytics_events (organization_id,event_id,visitor_key,session_key,event_name,page_path,screen,control,platform,device,source,created_at) VALUES (?,?,?,?,?,?,?,?,?,?,?,?)");
    $count=0;$pdo->beginTransaction();
    try { foreach($events as $event){$statement->execute([$org,...array_values($event)]);$count+=$statement->rowCount();} $pdo->commit();return $count; }
    catch(Throwable $error){if($pdo->inTransaction())$pdo->rollBack();throw $error;}
}
function analyticsFilters(array $query,?DateTimeImmutable $now=null): array {
    $now ??= new DateTimeImmutable('now',new DateTimeZone('Africa/Cairo'));$zone=new DateTimeZone('Africa/Cairo');
    $from=$query['from']??$now->modify('-29 days')->format('Y-m-d');$to=$query['to']??$now->format('Y-m-d');
    foreach([$from,$to] as $date){if(!is_string($date))fail('تاريخ غير صحيح.',422,'invalid_analytics_range');$parsed=DateTimeImmutable::createFromFormat('!Y-m-d',$date,$zone);if(!$parsed||$parsed->format('Y-m-d')!==$date)fail('تاريخ غير صحيح.',422,'invalid_analytics_range');}
    $start=new DateTimeImmutable($from,$zone);$end=new DateTimeImmutable($to,$zone);$days=(int)$start->diff($end)->format('%r%a')+1;
    if($days<1||$days>366||$to>$now->format('Y-m-d'))fail('اختر فترة لا تزيد عن 366 يومًا وتنتهي اليوم أو قبله.',422,'invalid_analytics_range');
    $filters=['from'=>$from,'to'=>$to,'start'=>$start->format('Y-m-d 00:00:00'),'end'=>$end->modify('+1 day')->format('Y-m-d 00:00:00'),'days'=>$days];
    foreach(['platform'=>['all','web','android_app','standalone'],'device'=>['all','desktop','mobile','tablet'],'screen'=>['all',...analyticsScreens()]] as $key=>$allowed){$value=$query[$key]??'all';if(!in_array($value,$allowed,true))fail('فلتر غير صحيح.',422,'invalid_analytics_filter');$filters[$key]=$value;}
    $page=$query['page']??'all';if(!is_string($page)||($page!=='all'&&!analyticsValidPage($page)))fail('فلتر الصفحة غير صحيح.',422,'invalid_analytics_filter');$filters['page']=$page==='all'?'all':(rtrim($page,'/')?:'/');
    $activity=$query['activity_page']??'1';if(!is_scalar($activity)||!ctype_digit((string)$activity)||(int)$activity<1||(int)$activity>10000)fail('رقم الصفحة غير صحيح.',422,'invalid_analytics_filter');$filters['activity_page']=(int)$activity;
    return $filters;
}
function analyticsWhere(int $org,array $filters): array {
    $where='organization_id=? AND created_at>=? AND created_at<?';$params=[$org,$filters['start'],$filters['end']];
    foreach(['platform'=>'platform','device'=>'device','page'=>'page_path','screen'=>'screen'] as $key=>$column)if($filters[$key]!=='all'){$where.=" AND $column=?";$params[]=$filters[$key];}
    return [$where,$params];
}
function analyticsViewSql(): string { return "(event_name='PageView' AND page_path<>'/dashboard' OR event_name='ClientScreenViewed')"; }
function analyticsSummary(PDO $pdo,string $where,array $params): array {
    $conditions=['page_views'=>analyticsViewSql(),'login_views'=>"event_name='PageView' AND page_path='/login'",'login_attempts'=>"event_name='ClientLoginAttempt'",'logins'=>"event_name='ClientLogin'",'login_failures'=>"event_name='ClientLoginFailed'",'registration_attempts'=>"event_name='RegistrationAttempt'",'registrations'=>"event_name='CompleteRegistration'",'registration_failures'=>"event_name='RegistrationFailed'",'downloads'=>"event_name='AndroidAppDownload'",'booking_requests'=>"event_name IN ('PackageBookingRequestSubmitted','AppointmentRequested')",'payment_proofs'=>"event_name='PaymentProofSubmitted'",'interaction_events'=>"event_name='ClientInteraction'"];
    $parts=['COUNT(DISTINCT visitor_key) AS visitors','COUNT(DISTINCT session_key) AS sessions'];
    foreach($conditions as $key=>$sql)$parts[]="COALESCE(SUM(CASE WHEN ($sql) THEN 1 ELSE 0 END),0) AS $key";
    $s=$pdo->prepare('SELECT '.implode(',',$parts)." FROM site_analytics_events WHERE $where");$s->execute($params);return array_map('intval',$s->fetch(PDO::FETCH_ASSOC));
}
function analyticsReport(PDO $pdo,int $org,array $filters): array {
    [$where,$params]=analyticsWhere($org,$filters);$query=function(string $sql,array $values=[])use($pdo){$q=$pdo->prepare($sql);$q->execute($values);return $q->fetchAll(PDO::FETCH_ASSOC);};
    $previous=$filters;$previous['end']=$filters['start'];$previous['start']=(new DateTimeImmutable($filters['start'],new DateTimeZone('Africa/Cairo')))->modify('-'.$filters['days'].' days')->format('Y-m-d H:i:s');[$previousWhere,$previousParams]=analyticsWhere($org,$previous);
    $views=analyticsViewSql();
    $daily=$query("SELECT SUBSTR(created_at,1,10) AS date, SUM(CASE WHEN $views THEN 1 ELSE 0 END) AS page_views,COUNT(DISTINCT visitor_key) AS visitors,COUNT(DISTINCT session_key) AS sessions,SUM(CASE WHEN event_name='ClientLogin' THEN 1 ELSE 0 END) AS logins,SUM(CASE WHEN event_name='CompleteRegistration' THEN 1 ELSE 0 END) AS registrations,SUM(CASE WHEN event_name='AndroidAppDownload' THEN 1 ELSE 0 END) AS downloads,SUM(CASE WHEN event_name IN ('PackageBookingRequestSubmitted','AppointmentRequested') THEN 1 ELSE 0 END) AS booking_requests FROM site_analytics_events WHERE $where GROUP BY SUBSTR(created_at,1,10) ORDER BY date",$params);
    $dailyByDate=array_column($daily,null,'date');$series=[];$date=new DateTimeImmutable($filters['from'],new DateTimeZone('Africa/Cairo'));
    for($i=0;$i<$filters['days'];$i++){$key=$date->modify("+$i days")->format('Y-m-d');$row=$dailyByDate[$key]??[];$series[]=['date'=>$key]+array_map('intval',array_intersect_key($row,array_flip(['page_views','visitors','sessions','logins','registrations','downloads','booking_requests'])))+array_fill_keys(['page_views','visitors','sessions','logins','registrations','downloads','booking_requests'],0);}
    $pages=$query("SELECT page_path AS page,screen,SUM(CASE WHEN $views THEN 1 ELSE 0 END) AS views,COUNT(DISTINCT visitor_key) AS visitors,COUNT(DISTINCT session_key) AS sessions,SUM(CASE WHEN event_name NOT IN ('PageView','ClientScreenViewed') THEN 1 ELSE 0 END) AS actions FROM site_analytics_events WHERE $where GROUP BY page_path,screen ORDER BY views DESC,actions DESC LIMIT 100",$params);
    $events=$query("SELECT event_name AS event,COUNT(*) AS count,COUNT(DISTINCT session_key) AS sessions FROM site_analytics_events WHERE $where GROUP BY event_name ORDER BY count DESC",$params);
    $dimensions=[];foreach(['source'=>'sources','platform'=>'platforms','device'=>'devices'] as $column=>$name)$dimensions[$name]=$query("SELECT $column,COUNT(DISTINCT session_key) AS sessions,COUNT(*) AS events FROM site_analytics_events WHERE $where GROUP BY $column ORDER BY sessions DESC",$params);
    $total=(int)$query("SELECT COUNT(*) AS total FROM site_analytics_events WHERE $where",$params)[0]['total'];$pagesCount=max(1,(int)ceil($total/25));$activityPage=min($filters['activity_page'],$pagesCount);$offset=($activityPage-1)*25;
    $recent=$query("SELECT event_name AS event,page_path AS page,screen,platform,device,control,created_at FROM site_analytics_events WHERE $where ORDER BY created_at DESC,event_id DESC LIMIT 25 OFFSET $offset",$params);
    $started=$query('SELECT MIN(created_at) AS started FROM site_analytics_events WHERE organization_id=?',[$org])[0]['started'];
    return ['from'=>$filters['from'],'to'=>$filters['to'],'timezone'=>'Africa/Cairo','tracking_started_at'=>$started,'summary'=>analyticsSummary($pdo,$where,$params),'previous'=>analyticsSummary($pdo,$previousWhere,$previousParams),'daily'=>$series,'pages'=>$pages,'events'=>$events,...$dimensions,'recent'=>$recent,'recent_total'=>$total,'recent_page'=>$activityPage,'recent_pages'=>$pagesCount];
}
function handlePublicAnalytics(PDO $pdo,array $config,string $path,string $method): void {
    if($path!=='/site-analytics/events'||$method!=='POST')return;
    if(empty($_SERVER['HTTP_ORIGIN'])||!str_starts_with(strtolower((string)($_SERVER['CONTENT_TYPE']??'')),'application/json'))fail('مصدر الإحصائيات غير صحيح.',403,'invalid_analytics_origin');
    if((int)($_SERVER['CONTENT_LENGTH']??0)>20000)fail('دفعة الإحصائيات كبيرة.',413,'analytics_batch_too_large');
    if(preg_match('/bot|crawler|spider|headless|preview/i',(string)($_SERVER['HTTP_USER_AGENT']??'')))respond(['accepted'=>0]);
    $events=analyticsNormalizeBatch(body());
    registrationRateLimit($pdo,'site_analytics',requestIpHash(),120,60,0,'analytics_rate_limited');
    analyticsSchema($pdo);respond(['accepted'=>analyticsInsert($pdo,registrationOrganization($config),$events)]);
}
function handleAnalyticsReport(PDO $pdo,?array $user,string $path,string $method): void {
    if($path!=='/site-analytics'||$method!=='GET')return;
    $user=requireUser($user);requireRole($user,['owner','admin']);$filters=analyticsFilters($_GET);analyticsSchema($pdo);respond(analyticsReport($pdo,(int)$user['organization_id'],$filters));
}
