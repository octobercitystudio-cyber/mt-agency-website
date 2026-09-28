<?php
declare(strict_types=1);

function ensureDeliveryLinkPinSchema(PDO $pdo): void {
    static $ready=false;if($ready)return;
    foreach(['is_pinned'=>'TINYINT(1) NOT NULL DEFAULT 0','published_at'=>'DATETIME NULL'] as $column=>$definition){
        if(schemaColumnExists($pdo,'video_delivery_links',$column))continue;
        try{$pdo->exec("ALTER TABLE video_delivery_links ADD COLUMN $column $definition");}
        catch(PDOException $error){if((int)($error->errorInfo[1]??0)!==1060)throw $error;continue;}
        if($column==='published_at')$pdo->exec("UPDATE video_delivery_links l JOIN post_production_jobs j ON j.id=l.post_production_job_id AND j.organization_id=l.organization_id SET l.published_at=l.created_at WHERE j.status IN ('upload_completed','delivered') AND l.is_active=1");
    }
    $ready=true;
}

function publishPendingDeliveryLinks(PDO $pdo,int $organizationId,int $jobId,string $status): void {
    if(!in_array($status,['upload_completed','delivered'],true))return;
    $job=$pdo->prepare('SELECT is_client_visible,needs_review FROM post_production_jobs WHERE id=? AND organization_id=?');$job->execute([$jobId,$organizationId]);$row=$job->fetch();
    if(!$row || (int)$row['is_client_visible']!==1 || (int)$row['needs_review']!==0)return;
    // Status retries/corrections never restart an already published link's clock.
    $pdo->prepare('UPDATE video_delivery_links SET published_at=COALESCE(published_at,NOW()) WHERE organization_id=? AND post_production_job_id=? AND is_active=1')->execute([$organizationId,$jobId]);
}

function savePostProductionDeliveryLinks(PDO $pdo,array $user,int $id,array $payload): array {
    $expected=filter_var($payload['expected_version']??null,FILTER_VALIDATE_INT);
    if($expected===false||$expected<1)fail('نسخة السجل مطلوبة.',422,'invalid_post_production_version');
    $links=validateDriveDeliveryLinks($payload['links']??null);$org=(int)$user['organization_id'];
    $pdo->beginTransaction();
    try{
        $stmt=$pdo->prepare('SELECT * FROM post_production_jobs WHERE id=? AND organization_id=? FOR UPDATE');$stmt->execute([$id,$org]);$job=$stmt->fetch();
        if(!$job)fail('جلسة المونتاج غير موجودة.',404,'post_production_not_found');
        $stmt=$pdo->prepare('SELECT * FROM video_delivery_links WHERE organization_id=? AND post_production_job_id=? ORDER BY sort_order,id');$stmt->execute([$org,$id]);$stored=$stmt->fetchAll();
        $before=array_map(fn($link)=>['title'=>(string)$link['title'],'link_kind'=>(string)$link['link_kind'],'url'=>(string)$link['url'],'url_hash'=>(string)$link['url_hash'],'sort_order'=>(int)$link['sort_order'],'is_active'=>(int)$link['is_active'],'is_pinned'=>(int)$link['is_pinned']],$stored);
        $version=(int)$job['version'];
        if($before===$links && in_array($expected,[$version,$version-1],true)){$pdo->commit();return ['id'=>$id,'version'=>$version,'links'=>$before,'idempotent'=>true];}
        if($version!==$expected)fail('تم تحديث الروابط من مستخدم آخر. حدّث الصفحة وحاول ثانية.',409,'post_production_version_conflict');
        $desired=array_column($links,null,'url_hash');$existing=array_column($stored,null,'url_hash');
        foreach($stored as $old){
            if(isset($desired[$old['url_hash']]))continue;
            if((int)$old['is_pinned']===1)fail('ألغِ تثبيت الفولدر واحفظ التغيير أولًا قبل حذف رابطه أو استبداله.',409,'pinned_delivery_folder_protected');
            $pdo->prepare('DELETE FROM video_delivery_links WHERE id=? AND organization_id=?')->execute([$old['id'],$org]);
        }
        foreach($links as $link){
            $published=$link['is_active']===1 && (int)$job['is_client_visible']===1 && (int)$job['needs_review']===0 && in_array($job['status'],['upload_completed','delivered'],true)?cairoNow()->format('Y-m-d H:i:s'):null;
            if(isset($existing[$link['url_hash']])){
                $pdo->prepare('UPDATE video_delivery_links SET title=?,link_kind=?,sort_order=?,is_active=?,is_pinned=?,published_at=COALESCE(published_at,?),updated_by=? WHERE id=? AND organization_id=?')->execute([$link['title'],$link['link_kind'],$link['sort_order'],$link['is_active'],$link['is_pinned'],$published,$user['id'],$existing[$link['url_hash']]['id'],$org]);
            }else{
                $pdo->prepare('INSERT INTO video_delivery_links (organization_id,post_production_job_id,title,link_kind,url,url_hash,sort_order,is_active,is_pinned,published_at,created_by,updated_by) VALUES (?,?,?,?,?,?,?,?,?,?,?,?)')->execute([$org,$id,$link['title'],$link['link_kind'],$link['url'],$link['url_hash'],$link['sort_order'],$link['is_active'],$link['is_pinned'],$published,$user['id'],$user['id']]);
            }
        }
        $version++;$pdo->prepare('UPDATE post_production_jobs SET version=?,updated_by=? WHERE id=? AND organization_id=?')->execute([$version,$user['id'],$id,$org]);
        audit($pdo,$user,'post_production_links_changed','post_production_jobs',$id,['links'=>$before,'version'=>$job['version']],['links'=>$links,'version'=>$version,'client_id'=>(int)$job['client_id']]);
        $pdo->commit();return ['id'=>$id,'version'=>$version,'links'=>$links,'idempotent'=>false];
    }catch(Throwable $error){if($pdo->inTransaction())$pdo->rollBack();throw $error;}
}
