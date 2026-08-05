CREATE TABLE `planner_provinces` (
	`id` text PRIMARY KEY NOT NULL,
	`code` text NOT NULL,
	`name_zh` text NOT NULL,
	`name_en` text NOT NULL,
	`display_order` integer DEFAULT 0 NOT NULL,
	`status` text DEFAULT 'published' NOT NULL,
	`created_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL,
	`updated_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX `uq_planner_provinces_code` ON `planner_provinces` (`code`);--> statement-breakpoint
CREATE INDEX `idx_planner_provinces_status_order` ON `planner_provinces` (`status`,`display_order`);--> statement-breakpoint
ALTER TABLE `planner_cities` ADD `province_code` text DEFAULT 'guizhou' NOT NULL;--> statement-breakpoint
ALTER TABLE `planner_destinations` ADD `province_code` text DEFAULT 'guizhou' NOT NULL;
--> statement-breakpoint
INSERT OR IGNORE INTO `planner_provinces` (`id`,`code`,`name_zh`,`name_en`,`display_order`,`status`) VALUES
  ('guizhou','guizhou','贵州省','Guizhou',1,'published');
--> statement-breakpoint
UPDATE `planner_cities` SET `province_code`='guizhou',`name_zh`='贵阳市',`name_en`='Guiyang',`display_order`=1,`status`='published' WHERE `id`='qianlin-guiyang' AND `tenant_id`='qianlin-travel';
--> statement-breakpoint
UPDATE `planner_cities` SET `province_code`='guizhou',`name_zh`='安顺市',`name_en`='Anshun',`display_order`=4,`status`='published' WHERE `id`='qianlin-anshun' AND `tenant_id`='qianlin-travel';
--> statement-breakpoint
UPDATE `planner_cities` SET `province_code`='guizhou',`name_zh`='铜仁市',`name_en`='Tongren',`display_order`=6,`status`='published' WHERE `id`='qianlin-tongren' AND `tenant_id`='qianlin-travel';
--> statement-breakpoint
INSERT OR IGNORE INTO `planner_cities` (`id`,`tenant_id`,`province_code`,`code`,`name_zh`,`name_en`,`available_as_start`,`available_as_end`,`display_order`,`status`) VALUES
  ('qianlin-zunyi','qianlin-travel','guizhou','zunyi','遵义市','Zunyi',1,1,2,'published'),
  ('qianlin-liupanshui','qianlin-travel','guizhou','liupanshui','六盘水市','Liupanshui',1,1,3,'published'),
  ('qianlin-bijie','qianlin-travel','guizhou','bijie','毕节市','Bijie',1,1,5,'published'),
  ('qianlin-qiandongnan','qianlin-travel','guizhou','qiandongnan','黔东南苗族侗族自治州','Qiandongnan Miao and Dong Autonomous Prefecture',1,1,7,'published'),
  ('qianlin-qiannan','qianlin-travel','guizhou','qiannan','黔南布依族苗族自治州','Qiannan Buyi and Miao Autonomous Prefecture',1,1,8,'published'),
  ('qianlin-qianxinan','qianlin-travel','guizhou','qianxinan','黔西南布依族苗族自治州','Qianxinan Buyi and Miao Autonomous Prefecture',1,1,9,'published');
--> statement-breakpoint
UPDATE `planner_cities` SET `status`='archived',`province_code`='guizhou' WHERE `tenant_id`='qianlin-travel' AND `code`='kaili';
--> statement-breakpoint
UPDATE `planner_destinations` SET `province_code`='guizhou',`city_code`='anshun',`route_order`=40,`display_order`=6,`status`='published' WHERE `id`='huangguoshu-waterfall' AND `tenant_id`='qianlin-travel';
--> statement-breakpoint
UPDATE `planner_destinations` SET `province_code`='guizhou',`city_code`='qiandongnan',`route_order`=70,`display_order`=11,`status`='published' WHERE `id`='xijiang-miao-village' AND `tenant_id`='qianlin-travel';
--> statement-breakpoint
UPDATE `planner_destinations` SET `province_code`='guizhou',`city_code`='qiannan',`route_order`=80,`display_order`=13,`status`='published' WHERE `id`='libo-xiaoqikong' AND `tenant_id`='qianlin-travel';
--> statement-breakpoint
UPDATE `planner_destinations` SET `province_code`='guizhou',`city_code`='tongren',`route_order`=60,`display_order`=10,`status`='published' WHERE `id`='fanjing-mountain' AND `tenant_id`='qianlin-travel';
--> statement-breakpoint
INSERT OR IGNORE INTO `planner_destinations` (`id`,`tenant_id`,`province_code`,`slug`,`city_code`,`name_zh`,`name_en`,`description_zh`,`description_en`,`image_url`,`card_size`,`region_zh`,`region_en`,`route_order`,`overnight_zh`,`overnight_en`,`recommended_visit_hours`,`major_attraction`,`available_for_planning`,`show_on_homepage`,`display_order`,`status`) VALUES
  ('qingyan-ancient-town','qianlin-travel','guizhou','qingyan-ancient-town','guiyang','青岩古镇','Qingyan Ancient Town','','','','small','贵阳市','Guiyang',10,'','',NULL,0,1,0,1,'published'),
  ('jiaxiu-pavilion','qianlin-travel','guizhou','jiaxiu-pavilion','guiyang','甲秀楼','Jiaxiu Pavilion','','','','small','贵阳市','Guiyang',11,'','',NULL,0,1,0,2,'published'),
  ('zunyi-conference-site','qianlin-travel','guizhou','zunyi-conference-site','zunyi','遵义会议会址','Zunyi Conference Site','','','','small','遵义市','Zunyi',20,'','',NULL,0,1,0,3,'published'),
  ('chishui-danxia','qianlin-travel','guizhou','chishui-danxia','zunyi','赤水丹霞','Chishui Danxia','','','','small','遵义市','Zunyi',21,'','',NULL,0,1,0,4,'published'),
  ('wumeng-grassland','qianlin-travel','guizhou','wumeng-grassland','liupanshui','乌蒙大草原','Wumeng Grassland','','','','small','六盘水市','Liupanshui',30,'','',NULL,0,1,0,5,'published'),
  ('longgong-scenic-area','qianlin-travel','guizhou','longgong-scenic-area','anshun','龙宫','Longgong Scenic Area','','','','small','安顺市','Anshun',41,'','',NULL,0,1,0,7,'published'),
  ('baili-rhododendron','qianlin-travel','guizhou','baili-rhododendron','bijie','百里杜鹃','Baili Rhododendron Scenic Area','','','','small','毕节市','Bijie',50,'','',NULL,0,1,0,8,'published'),
  ('zhijin-cave','qianlin-travel','guizhou','zhijin-cave','bijie','织金洞','Zhijin Cave','','','','small','毕节市','Bijie',51,'','',NULL,0,1,0,9,'published'),
  ('zhenyuan-ancient-town','qianlin-travel','guizhou','zhenyuan-ancient-town','qiandongnan','镇远古城','Zhenyuan Ancient Town','','','','small','黔东南苗族侗族自治州','Qiandongnan',71,'','',NULL,0,1,0,12,'published'),
  ('china-sky-eye-fast','qianlin-travel','guizhou','china-sky-eye-fast','qiannan','中国天眼','China Sky Eye (FAST)','','','','small','黔南布依族苗族自治州','Qiannan',81,'','',NULL,0,1,0,14,'published'),
  ('wanfenglin','qianlin-travel','guizhou','wanfenglin','qianxinan','万峰林','Wanfenglin Scenic Area','','','','small','黔西南布依族苗族自治州','Qianxinan',90,'','',NULL,0,1,0,15,'published'),
  ('malinghe-canyon','qianlin-travel','guizhou','malinghe-canyon','qianxinan','马岭河峡谷','Malinghe Canyon','','','','small','黔西南布依族苗族自治州','Qianxinan',91,'','',NULL,0,1,0,16,'published');
