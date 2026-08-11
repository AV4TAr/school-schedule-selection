-- Multi-tenancy: every row now belongs to exactly one schedule.
--
-- WHY THIS AVOIDS THE OBVIOUS APPROACH
--
-- The natural way to add these columns is SQLite's 12-step table rebuild
-- (create __new_x, copy, drop, rename). That is *unsafe here*, because
-- `PRAGMA foreign_keys=OFF` is silently a no-op inside a transaction — and
-- Drizzle's migrator wraps every migration in one. With foreign keys still
-- live, `DROP TABLE people` cascades and deletes every availability row and
-- assignment that referenced it. That is exactly what happened the first time
-- this migration was written, and it cost a full restore from backup.
--
-- So: no parent table is ever dropped. Columns are added in place, which
-- SQLite permits as long as the added column has no REFERENCES clause. The
-- trade-off is that people/shifts/availability/undo_stack carry no database-
-- level foreign key to `schedules`; deleting a schedule must therefore clean
-- up its rows in application code rather than relying on ON DELETE CASCADE.

-- --- schedules: gains `code` (unique) and `password_hash` -------------------
-- Added nullable because a NOT NULL column needs a default, and a default on a
-- unique column could only ever be used once. The unique index still enforces
-- distinctness, and the app always supplies a code.
ALTER TABLE `schedules` ADD `code` text;--> statement-breakpoint
ALTER TABLE `schedules` ADD `password_hash` text;--> statement-breakpoint
UPDATE `schedules`
SET `code` = 'PNR2-F7ZH',
    `password_hash` = 'ec928940b6f654ac22447823185f6efe:82df4a3b3a48fec351a7f058bf0b584c2ce2da5928c64169d0d8402d722a8a9d293dfac5c5aba33bf45b40248de68bcf4c95df0b60b1fda108e55111a6485a64'
WHERE `id` = 1;--> statement-breakpoint
-- Any other pre-existing schedule (there should be none) still needs a code.
UPDATE `schedules` SET `code` = 'MIGR-' || substr('0000' || `id`, -4) WHERE `code` IS NULL;--> statement-breakpoint
CREATE UNIQUE INDEX `schedules_code_unique` ON `schedules` (`code`);--> statement-breakpoint

-- --- scope columns, added in place ------------------------------------------
ALTER TABLE `people` ADD `schedule_id` integer DEFAULT 1 NOT NULL;--> statement-breakpoint
CREATE INDEX `people_schedule_idx` ON `people` (`schedule_id`);--> statement-breakpoint
ALTER TABLE `shifts` ADD `schedule_id` integer DEFAULT 1 NOT NULL;--> statement-breakpoint
CREATE INDEX `shifts_schedule_idx` ON `shifts` (`schedule_id`);--> statement-breakpoint
ALTER TABLE `availability` ADD `schedule_id` integer DEFAULT 1 NOT NULL;--> statement-breakpoint
CREATE INDEX `availability_schedule_idx` ON `availability` (`schedule_id`);--> statement-breakpoint
ALTER TABLE `undo_stack` ADD `schedule_id` integer DEFAULT 1 NOT NULL;--> statement-breakpoint
CREATE INDEX `undo_schedule_idx` ON `undo_stack` (`schedule_id`);--> statement-breakpoint

-- --- settings: primary key becomes (schedule_id, key) ----------------------
-- Safe to rebuild: nothing references `settings`, so dropping it cascades to
-- nothing.
CREATE TABLE `__new_settings` (
	`schedule_id` integer DEFAULT 1 NOT NULL,
	`key` text NOT NULL,
	`value` text NOT NULL,
	PRIMARY KEY(`schedule_id`, `key`)
);
--> statement-breakpoint
INSERT INTO `__new_settings`("schedule_id", "key", "value") SELECT 1, "key", "value" FROM `settings`;--> statement-breakpoint
DROP TABLE `settings`;--> statement-breakpoint
ALTER TABLE `__new_settings` RENAME TO `settings`;
