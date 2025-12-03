-- Drop old_ims_ tables (deprecated)
-- v1.0 - 2025-12-03

DROP TABLE IF EXISTS public.old_ims_store_purchase_price CASCADE;
DROP TABLE IF EXISTS public.old_ims_product_sku CASCADE;
DROP TABLE IF EXISTS public.old_ims_product CASCADE;
DROP TABLE IF EXISTS public.old_ims_supplier CASCADE;
DROP TABLE IF EXISTS public.old_ims_unit_of_measure CASCADE;
