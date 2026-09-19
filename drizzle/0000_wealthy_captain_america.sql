CREATE TABLE "solar_consents" (
	"id" text PRIMARY KEY NOT NULL,
	"lead_id" text NOT NULL,
	"granted_at" timestamp with time zone NOT NULL,
	"withdrawn_at" timestamp with time zone,
	"version" text NOT NULL,
	"text_shown" text NOT NULL,
	"purpose" text NOT NULL,
	"channel" text NOT NULL
);
--> statement-breakpoint
ALTER TABLE "solar_consents" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
CREATE TABLE "solar_leads" (
	"id" text PRIMARY KEY NOT NULL,
	"created_at" timestamp with time zone NOT NULL,
	"updated_at" timestamp with time zone NOT NULL,
	"name" text NOT NULL,
	"email" text NOT NULL,
	"phone" text,
	"raw_address" text NOT NULL,
	"formatted_address" text,
	"latitude" double precision,
	"longitude" double precision,
	"state" text DEFAULT 'nuevo' NOT NULL,
	"state_reason" text,
	"channel" text DEFAULT 'web' NOT NULL,
	"campaign" text,
	"notes" text
);
--> statement-breakpoint
ALTER TABLE "solar_leads" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
CREATE TABLE "solar_studies" (
	"id" text PRIMARY KEY NOT NULL,
	"lead_id" text NOT NULL,
	"created_at" timestamp with time zone NOT NULL,
	"recommended_kwp" double precision NOT NULL,
	"annual_production_kwh" double precision NOT NULL,
	"investment_eur" double precision NOT NULL,
	"first_year_savings_eur" double precision NOT NULL,
	"payback_years" double precision,
	"confidence" text NOT NULL,
	"payload" jsonb NOT NULL
);
--> statement-breakpoint
ALTER TABLE "solar_studies" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
ALTER TABLE "solar_consents" ADD CONSTRAINT "solar_consents_lead_id_solar_leads_id_fk" FOREIGN KEY ("lead_id") REFERENCES "public"."solar_leads"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "solar_studies" ADD CONSTRAINT "solar_studies_lead_id_solar_leads_id_fk" FOREIGN KEY ("lead_id") REFERENCES "public"."solar_leads"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "solar_consents_lead_idx" ON "solar_consents" USING btree ("lead_id");--> statement-breakpoint
CREATE INDEX "solar_leads_state_idx" ON "solar_leads" USING btree ("state");--> statement-breakpoint
CREATE INDEX "solar_leads_created_idx" ON "solar_leads" USING btree ("created_at");--> statement-breakpoint
CREATE INDEX "solar_leads_email_idx" ON "solar_leads" USING btree ("email");--> statement-breakpoint
CREATE INDEX "solar_studies_lead_idx" ON "solar_studies" USING btree ("lead_id");