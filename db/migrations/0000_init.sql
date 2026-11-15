CREATE TABLE "aoi" (
	"id" text PRIMARY KEY NOT NULL,
	"kind" text NOT NULL,
	"geojson" jsonb NOT NULL,
	"cells_compact" bigint[] NOT NULL,
	"resolution" smallint NOT NULL,
	"area_km2" double precision NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "cell_month" (
	"version_id" text NOT NULL,
	"h3" bigint NOT NULL,
	"year" smallint NOT NULL,
	"month" smallint NOT NULL,
	"harm" real NOT NULL,
	"harm_lo" real NOT NULL,
	"harm_hi" real NOT NULL,
	"raw_modis" integer NOT NULL,
	"raw_viirs" integer NOT NULL,
	"frp" real NOT NULL,
	"processing" varchar(3) NOT NULL,
	CONSTRAINT "cell_month_version_id_h3_year_month_pk" PRIMARY KEY("version_id","h3","year","month")
);
--> statement-breakpoint
CREATE TABLE "cell_month_r4" (
	"version_id" text NOT NULL,
	"h3" bigint NOT NULL,
	"year" smallint NOT NULL,
	"month" smallint NOT NULL,
	"harm" real NOT NULL,
	"harm_lo" real NOT NULL,
	"harm_hi" real NOT NULL,
	"raw_modis" integer NOT NULL,
	"raw_viirs" integer NOT NULL,
	"frp" real NOT NULL,
	"processing" varchar(3) NOT NULL,
	CONSTRAINT "cell_month_r4_version_id_h3_year_month_pk" PRIMARY KEY("version_id","h3","year","month")
);
--> statement-breakpoint
CREATE TABLE "dataset_version" (
	"id" text PRIMARY KEY NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"meta" jsonb NOT NULL,
	"is_active" boolean DEFAULT false NOT NULL
);
--> statement-breakpoint
CREATE TABLE "region" (
	"iso3" text PRIMARY KEY NOT NULL,
	"name_en" text NOT NULL,
	"name_ru" text,
	"bbox" double precision[] NOT NULL,
	"geom_blob_url" text
);
--> statement-breakpoint
CREATE TABLE "region_cell" (
	"iso3" text NOT NULL,
	"h3" bigint NOT NULL,
	CONSTRAINT "region_cell_iso3_h3_pk" PRIMARY KEY("iso3","h3")
);
--> statement-breakpoint
CREATE TABLE "region_month" (
	"version_id" text NOT NULL,
	"iso3" text NOT NULL,
	"year" smallint NOT NULL,
	"month" smallint NOT NULL,
	"harm" real NOT NULL,
	"harm_lo" real NOT NULL,
	"harm_hi" real NOT NULL,
	"raw_modis" integer NOT NULL,
	"raw_viirs" integer NOT NULL,
	CONSTRAINT "region_month_version_id_iso3_year_month_pk" PRIMARY KEY("version_id","iso3","year","month")
);
--> statement-breakpoint
ALTER TABLE "cell_month" ADD CONSTRAINT "cell_month_version_id_dataset_version_id_fk" FOREIGN KEY ("version_id") REFERENCES "public"."dataset_version"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "cell_month_r4" ADD CONSTRAINT "cell_month_r4_version_id_dataset_version_id_fk" FOREIGN KEY ("version_id") REFERENCES "public"."dataset_version"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "region_cell" ADD CONSTRAINT "region_cell_iso3_region_iso3_fk" FOREIGN KEY ("iso3") REFERENCES "public"."region"("iso3") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "region_month" ADD CONSTRAINT "region_month_version_id_dataset_version_id_fk" FOREIGN KEY ("version_id") REFERENCES "public"."dataset_version"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "region_month" ADD CONSTRAINT "region_month_iso3_region_iso3_fk" FOREIGN KEY ("iso3") REFERENCES "public"."region"("iso3") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "dataset_version_one_active" ON "dataset_version" USING btree ("is_active") WHERE "dataset_version"."is_active";--> statement-breakpoint
CREATE INDEX "region_cell_h3" ON "region_cell" USING btree ("h3");