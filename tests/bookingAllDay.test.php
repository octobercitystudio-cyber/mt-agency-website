<?php
declare(strict_types=1);
// Exercise production validators directly without accessing the live database.
$source=file_get_contents(__DIR__.'/../api/index.php');
foreach(['normalizeBusinessTime','businessTimeMinutes','bookingDurationMinutes','validateClientBookingTimeGrid','validBusinessBooking','validateBookingSchedule','bookingBlockDate','bookingBlockDates'] as $name){
    if(!preg_match('/^function '.preg_quote($name,'/').'\b.*?^\}/ms',$source,$match))throw new RuntimeException('Missing '.$name);
    eval($match[0]);
}
function fail(string $message,int $status=400,string $code='error'):never{throw new RuntimeException($code);}
function arabicDurationMinutes(int $minutes):string{return (string)$minutes;}
function check(bool $condition,string $message):void{if(!$condition)throw new RuntimeException($message);}
function rejected(callable $callback,string $code):void{try{$callback();}catch(RuntimeException $error){check($error->getMessage()===$code,'Unexpected error: '.$error->getMessage());return;}throw new RuntimeException('Expected '.$code);}
class BookingResourceStatement extends PDOStatement{
    public function execute(?array $params=null):bool{return true;}
    public function fetch(int $mode=PDO::FETCH_DEFAULT,int $cursorOrientation=PDO::FETCH_ORI_NEXT,int $cursorOffset=0):mixed{return ['id'=>1];}
}
class BookingResourcePdo extends PDO{
    public function __construct(){}
    public function prepare(string $query,array $options=[]):PDOStatement|false{return new BookingResourceStatement();}
}
$pdo=new BookingResourcePdo();
$package=['starts_at'=>'2027-01-01','expires_at'=>'2027-01-31','validity_mode_snapshot'=>'rolling'];
foreach([['00:00','01:00',60],['08:00','09:15',75],['23:00','24:00',60],['00:00','24:00',1440]] as [$start,$end,$duration]){
    check(validBusinessBooking($start,$end),'Valid full-day interval rejected');
    check(validateBookingSchedule($pdo,1,1,'2027-01-08',$start,$end,60,15,null,$package,false)===$duration,'Friday schedule rejected');
}
check(!validBusinessBooking('23:00','01:00'),'Overnight interval must use a separate date');
check(!validBusinessBooking('08:00','08:15'),'Minimum duration lost');
check(!validBusinessBooking('24:00','24:00'),'Invalid start accepted');
rejected(fn()=>validateClientBookingTimeGrid('00:00','24:00',1440),'client_booking_duration_out_of_range');
check(validateClientBookingTimeGrid('12:00','22:00',600)===600,'Client opening hours rejected');
rejected(fn()=>validateClientBookingTimeGrid('08:00','09:30',90),'client_booking_outside_hours');
rejected(fn()=>validateClientBookingTimeGrid('08:15','09:15',60),'client_booking_start_grid_invalid');
rejected(fn()=>validateClientBookingTimeGrid('23:00','01:00',120),'client_booking_after_midnight');
rejected(fn()=>validateBookingSchedule($pdo,1,1,'2027-02-05','08:00','09:00',60,15,null,$package,false),'booking_outside_package_validity');
rejected(fn()=>validateBookingSchedule($pdo,1,1,'2027-02-30','08:00','09:00',60,15,null,null,false),'invalid_booking_time');
check(bookingBlockDates('2027-01-08',false,'')===['2027-01-08'],'Single Friday block rejected');
check(bookingBlockDates('2027-01-07',true,'2027-01-09')===['2027-01-07','2027-01-08','2027-01-09'],'Daily repeat skipped Friday');
rejected(fn()=>bookingBlockDates('2027-01-01',true,'2027-04-01'),'booking_block_range_too_long');
echo "PASS: production Friday, morning, midnight, full-day, repeat, validity and duration boundaries.\n";
