CREATE TABLE `alerts` (
	`id` int AUTO_INCREMENT NOT NULL,
	`businessId` int NOT NULL,
	`type` varchar(60) NOT NULL,
	`severity` enum('info','warning','critical') NOT NULL DEFAULT 'info',
	`title` varchar(180) NOT NULL,
	`body` text NOT NULL,
	`status` enum('open','dismissed') NOT NULL DEFAULT 'open',
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `alerts_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `audit_logs` (
	`id` int AUTO_INCREMENT NOT NULL,
	`businessId` int NOT NULL,
	`userId` int NOT NULL,
	`action` varchar(120) NOT NULL,
	`entityType` varchar(80),
	`entityId` int,
	`metadata` text,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `audit_logs_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `businesses` (
	`id` int AUTO_INCREMENT NOT NULL,
	`ownerId` int NOT NULL,
	`name` varchar(160) NOT NULL,
	`type` varchar(80) NOT NULL DEFAULT 'Cafe',
	`location` varchar(160),
	`currency` varchar(8) NOT NULL DEFAULT 'INR',
	`taxRate` decimal(6,2) NOT NULL DEFAULT '5.00',
	`openingHours` varchar(160) DEFAULT '08:00–22:00',
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `businesses_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `customers` (
	`id` int AUTO_INCREMENT NOT NULL,
	`businessId` int NOT NULL,
	`externalId` varchar(100) NOT NULL,
	`name` varchar(160),
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `customers_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `forecasts` (
	`id` int AUTO_INCREMENT NOT NULL,
	`businessId` int NOT NULL,
	`horizon` varchar(40) NOT NULL DEFAULT '7_days',
	`forecastDate` timestamp NOT NULL,
	`predictedRevenue` decimal(14,2) NOT NULL,
	`model` varchar(80) NOT NULL DEFAULT 'weighted_moving_average',
	`mae` decimal(14,2) DEFAULT '0.00',
	`rmse` decimal(14,2) DEFAULT '0.00',
	`mape` decimal(8,2) DEFAULT '0.00',
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `forecasts_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `insights` (
	`id` int AUTO_INCREMENT NOT NULL,
	`businessId` int NOT NULL,
	`type` varchar(60) NOT NULL,
	`title` varchar(180) NOT NULL,
	`body` text NOT NULL,
	`status` enum('new','read','archived') NOT NULL DEFAULT 'new',
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `insights_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `inventory` (
	`id` int AUTO_INCREMENT NOT NULL,
	`businessId` int NOT NULL,
	`productId` int NOT NULL,
	`currentStock` decimal(12,2) NOT NULL DEFAULT '0.00',
	`minimumStock` decimal(12,2) NOT NULL DEFAULT '0.00',
	`unit` varchar(24) NOT NULL DEFAULT 'units',
	`supplier` varchar(160),
	`lastRestocked` timestamp,
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `inventory_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `products` (
	`id` int AUTO_INCREMENT NOT NULL,
	`businessId` int NOT NULL,
	`name` varchar(160) NOT NULL,
	`category` varchar(80) NOT NULL DEFAULT 'General',
	`price` decimal(12,2) NOT NULL DEFAULT '0.00',
	`cost` decimal(12,2) NOT NULL DEFAULT '0.00',
	`active` boolean NOT NULL DEFAULT true,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `products_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `sales` (
	`id` int AUTO_INCREMENT NOT NULL,
	`businessId` int NOT NULL,
	`saleDate` timestamp NOT NULL,
	`productId` int NOT NULL,
	`customerId` int,
	`quantity` int NOT NULL,
	`unitPrice` decimal(12,2) NOT NULL,
	`unitCost` decimal(12,2) NOT NULL,
	`revenue` decimal(14,2) NOT NULL,
	`cost` decimal(14,2) NOT NULL,
	`profit` decimal(14,2) NOT NULL,
	`channel` varchar(40) DEFAULT 'in_store',
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `sales_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `uploads` (
	`id` int AUTO_INCREMENT NOT NULL,
	`businessId` int NOT NULL,
	`fileName` varchar(255) NOT NULL,
	`storageKey` varchar(512),
	`status` enum('processing','complete','failed') NOT NULL DEFAULT 'processing',
	`rowsProcessed` int NOT NULL DEFAULT 0,
	`rowsRejected` int NOT NULL DEFAULT 0,
	`validationMessage` text,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `uploads_id` PRIMARY KEY(`id`)
);
