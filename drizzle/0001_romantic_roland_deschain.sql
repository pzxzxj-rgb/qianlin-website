CREATE TABLE `planner_cities` (
	`id` text PRIMARY KEY NOT NULL,
	`tenant_id` text NOT NULL,
	`code` text NOT NULL,
	`name_zh` text NOT NULL,
	`name_en` text NOT NULL,
	`available_as_start` integer DEFAULT true NOT NULL,
	`available_as_end` integer DEFAULT true NOT NULL,
	`display_order` integer DEFAULT 0 NOT NULL,
	`status` text DEFAULT 'published' NOT NULL,
	`created_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL,
	`updated_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX `uq_planner_cities_tenant_code` ON `planner_cities` (`tenant_id`,`code`);--> statement-breakpoint
CREATE INDEX `idx_planner_cities_tenant_status_order` ON `planner_cities` (`tenant_id`,`status`,`display_order`);--> statement-breakpoint
CREATE TABLE `planner_destinations` (
	`id` text PRIMARY KEY NOT NULL,
	`tenant_id` text NOT NULL,
	`slug` text NOT NULL,
	`city_code` text,
	`name_zh` text NOT NULL,
	`name_en` text NOT NULL,
	`description_zh` text DEFAULT '' NOT NULL,
	`description_en` text DEFAULT '' NOT NULL,
	`image_url` text DEFAULT '' NOT NULL,
	`card_size` text DEFAULT 'small' NOT NULL,
	`region_zh` text NOT NULL,
	`region_en` text NOT NULL,
	`route_order` integer DEFAULT 0 NOT NULL,
	`overnight_zh` text DEFAULT '' NOT NULL,
	`overnight_en` text DEFAULT '' NOT NULL,
	`recommended_visit_hours` integer,
	`major_attraction` integer DEFAULT false NOT NULL,
	`available_for_planning` integer DEFAULT true NOT NULL,
	`show_on_homepage` integer DEFAULT true NOT NULL,
	`display_order` integer DEFAULT 0 NOT NULL,
	`status` text DEFAULT 'published' NOT NULL,
	`created_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL,
	`updated_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX `uq_planner_destinations_tenant_slug` ON `planner_destinations` (`tenant_id`,`slug`);--> statement-breakpoint
CREATE INDEX `idx_planner_destinations_tenant_status_order` ON `planner_destinations` (`tenant_id`,`status`,`display_order`);--> statement-breakpoint
CREATE INDEX `idx_planner_destinations_planning_order` ON `planner_destinations` (`tenant_id`,`status`,`available_for_planning`,`route_order`);--> statement-breakpoint
CREATE INDEX `idx_planner_destinations_homepage_order` ON `planner_destinations` (`tenant_id`,`status`,`show_on_homepage`,`display_order`);
--> statement-breakpoint
INSERT INTO `planner_cities` (`id`,`tenant_id`,`code`,`name_zh`,`name_en`,`available_as_start`,`available_as_end`,`display_order`,`status`) VALUES
  ('qianlin-guiyang','qianlin-travel','guiyang','贵阳','Guiyang',1,1,1,'published'),
  ('qianlin-anshun','qianlin-travel','anshun','安顺','Anshun',1,1,2,'published'),
  ('qianlin-kaili','qianlin-travel','kaili','凯里','Kaili',1,1,3,'published'),
  ('qianlin-tongren','qianlin-travel','tongren','铜仁','Tongren',1,1,4,'published');
--> statement-breakpoint
INSERT INTO `planner_destinations` (`id`,`tenant_id`,`slug`,`city_code`,`name_zh`,`name_en`,`description_zh`,`description_en`,`image_url`,`card_size`,`region_zh`,`region_en`,`route_order`,`overnight_zh`,`overnight_en`,`recommended_visit_hours`,`major_attraction`,`available_for_planning`,`show_on_homepage`,`display_order`,`status`) VALUES
  ('huangguoshu-waterfall','qianlin-travel','huangguoshu-waterfall','anshun','黄果树瀑布','Huangguoshu Waterfall','水，以最壮观的方式出现。','Water in its most spectacular form.','/images/guizhou/huangguoshu.png','large','安顺与西部贵州','Anshun and western Guizhou',1,'黄果树或安顺','Huangguoshu or Anshun',6,1,1,1,1,'published'),
  ('xijiang-miao-village','qianlin-travel','xijiang-miao-village','kaili','西江千户苗寨','Xijiang Miao Village','山间人家、温暖灯火与仍在发生的文化。','Mountain homes, warm lights, living culture.','/images/guizhou/xijiang-miao-village.png','small','黔东南苗寨','Southeast Guizhou villages',3,'西江或凯里','Xijiang or Kaili',5,0,1,1,2,'published'),
  ('libo-xiaoqikong','qianlin-travel','libo-xiaoqikong',NULL,'荔波小七孔','Libo Xiaoqikong','穿行森林的一条碧绿水带。','A green ribbon of water through the forest.','/images/guizhou/libo-xiaoqikong.png','small','荔波与南部贵州','Libo and southern Guizhou',2,'荔波','Libo',7,0,1,1,3,'published'),
  ('fanjing-mountain','qianlin-travel','fanjing-mountain','tongren','梵净山','Fanjing Mountain','云雾、峭壁，以及不断向上的心境。','Clouds, cliffs and a sense of elevation.','/images/guizhou/fanjing-mountain.png','small','铜仁与黔东北','Tongren and northeast Guizhou',4,'铜仁或梵净山周边','Tongren or near Fanjing Mountain',8,1,1,1,4,'published');
