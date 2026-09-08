ALTER TABLE `sales` ADD `sourceHash` varchar(64);--> statement-breakpoint
ALTER TABLE `customers` ADD CONSTRAINT `customers_business_external_id_unique` UNIQUE(`businessId`,`externalId`);--> statement-breakpoint
ALTER TABLE `inventory` ADD CONSTRAINT `inventory_business_product_unique` UNIQUE(`businessId`,`productId`);--> statement-breakpoint
ALTER TABLE `sales` ADD CONSTRAINT `sales_business_source_hash_unique` UNIQUE(`businessId`,`sourceHash`);