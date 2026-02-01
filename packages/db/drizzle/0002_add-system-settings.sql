CREATE TABLE "system_settings" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"log_provider" varchar(20) DEFAULT 'console' NOT NULL,
	"log_level" varchar(10) DEFAULT 'info' NOT NULL,
	"log_service_name" varchar(100) DEFAULT 'fyren-api' NOT NULL,
	"loki_url" varchar(500),
	"loki_config" text,
	"otlp_endpoint" varchar(500),
	"otlp_config" text,
	"updated_at" timestamp DEFAULT now() NOT NULL,
	"updated_by" text
);
