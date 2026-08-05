UPDATE `tenant_site_profiles`
SET `customize_image_url` = '/images/guizhou/customize-mountains.png',
    `customize_image_alt_zh` = '贵州层叠群山主题视觉图',
    `customize_image_alt_en` = 'Layered Guizhou mountains travel visual'
WHERE `tenant_id` = 'qianlin-travel' AND `status` = 'published';
