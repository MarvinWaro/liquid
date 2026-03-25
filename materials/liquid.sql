-- phpMyAdmin SQL Dump
-- version 5.2.1
-- https://www.phpmyadmin.net/
--
-- Host: 127.0.0.1
-- Generation Time: Mar 24, 2026 at 03:55 AM
-- Server version: 10.4.32-MariaDB
-- PHP Version: 8.2.12

SET FOREIGN_KEY_CHECKS=0;
SET SQL_MODE = "NO_AUTO_VALUE_ON_ZERO";
START TRANSACTION;
SET time_zone = "+00:00";


/*!40101 SET @OLD_CHARACTER_SET_CLIENT=@@CHARACTER_SET_CLIENT */;
/*!40101 SET @OLD_CHARACTER_SET_RESULTS=@@CHARACTER_SET_RESULTS */;
/*!40101 SET @OLD_COLLATION_CONNECTION=@@COLLATION_CONNECTION */;
/*!40101 SET NAMES utf8mb4 */;

--
-- Database: `liquid`
--

-- --------------------------------------------------------

--
-- Table structure for table `academic_years`
--

CREATE TABLE IF NOT EXISTS `academic_years` (
  `id` char(36) NOT NULL,
  `code` varchar(20) NOT NULL,
  `name` varchar(50) NOT NULL,
  `start_date` date DEFAULT NULL,
  `end_date` date DEFAULT NULL,
  `sort_order` int(11) NOT NULL DEFAULT 0,
  `is_active` tinyint(1) NOT NULL DEFAULT 1,
  `created_at` timestamp NULL DEFAULT NULL,
  `updated_at` timestamp NULL DEFAULT NULL,
  PRIMARY KEY (`id`),
  UNIQUE KEY `academic_years_code_unique` (`code`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

--
-- RELATIONSHIPS FOR TABLE `academic_years`:
--

--
-- Dumping data for table `academic_years`
--

INSERT INTO `academic_years` (`id`, `code`, `name`, `start_date`, `end_date`, `sort_order`, `is_active`, `created_at`, `updated_at`) VALUES
('09dcdab0-28ba-4c30-a85a-187177a4e114', '2020-2021', '2020-2021', NULL, NULL, 6, 1, '2026-03-23 08:35:39', '2026-03-23 18:09:25'),
('49d1f639-83b8-42dc-82e8-bf8f15e6bb77', '2021-2022', '2021-2022', NULL, NULL, 5, 1, '2026-03-23 08:35:49', '2026-03-23 18:09:25'),
('8ccff753-4a05-45e5-a7c5-223a7dfbe357', '2026-2027', '2026-2027', NULL, NULL, 0, 1, '2026-03-23 08:36:18', '2026-03-23 18:09:25'),
('8e1bbe6f-6c6f-4bc6-bc3b-4a15317b5cf5', '2024-2025', '2024-2025', NULL, NULL, 2, 1, '2026-03-23 08:36:11', '2026-03-23 18:09:25'),
('abfcf8d6-f64f-4bec-95a7-8f9c9e043538', '2023-2024', '2023-2024', NULL, NULL, 3, 1, '2026-03-23 08:36:05', '2026-03-23 18:09:25'),
('ca1f71bf-1a84-44b7-b905-bf1aacd8ce8a', '2025-2026', '2025-2026', NULL, NULL, 1, 1, '2026-03-23 08:36:15', '2026-03-23 18:09:25'),
('f5c831f2-2e08-44d1-b479-766ce2b24d9e', '2022-2023', '2022-2023', NULL, NULL, 4, 1, '2026-03-23 08:36:00', '2026-03-23 18:09:25');

-- --------------------------------------------------------

--
-- Table structure for table `academic_year_document_requirements`
--

CREATE TABLE IF NOT EXISTS `academic_year_document_requirements` (
  `id` char(36) NOT NULL,
  `academic_year_id` char(36) NOT NULL,
  `document_requirement_id` char(36) NOT NULL,
  `is_required` tinyint(1) NOT NULL DEFAULT 1,
  `is_active` tinyint(1) NOT NULL DEFAULT 1,
  `sort_order` int(11) NOT NULL DEFAULT 0,
  `created_at` timestamp NULL DEFAULT NULL,
  `updated_at` timestamp NULL DEFAULT NULL,
  PRIMARY KEY (`id`),
  UNIQUE KEY `ay_doc_req_unique` (`academic_year_id`,`document_requirement_id`),
  KEY `ay_req_dr_fk` (`document_requirement_id`),
  KEY `academic_year_document_requirements_academic_year_id_index` (`academic_year_id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

--
-- RELATIONSHIPS FOR TABLE `academic_year_document_requirements`:
--   `academic_year_id`
--       `academic_years` -> `id`
--   `document_requirement_id`
--       `document_requirements` -> `id`
--

--
-- Dumping data for table `academic_year_document_requirements`
--

INSERT INTO `academic_year_document_requirements` (`id`, `academic_year_id`, `document_requirement_id`, `is_required`, `is_active`, `sort_order`, `created_at`, `updated_at`) VALUES
('657e95ba-6c79-4aaa-81ce-8ba45c118b2c', 'ca1f71bf-1a84-44b7-b905-bf1aacd8ce8a', 'fe119d28-021f-4e73-8b62-35183c4a3c4c', 1, 0, 0, '2026-03-23 18:10:59', '2026-03-23 18:10:59'),
('7295f158-4825-43df-8986-cc42ce0bfe69', '8e1bbe6f-6c6f-4bc6-bc3b-4a15317b5cf5', '6570c333-2559-4758-b402-70945883137b', 1, 0, 0, '2026-03-23 18:09:46', '2026-03-23 18:09:46'),
('9ec9a6fa-57b3-4f9d-bd96-61830a41f3d4', '8e1bbe6f-6c6f-4bc6-bc3b-4a15317b5cf5', 'f08af5fd-87b5-49c4-90d7-62d8ff01b9d7', 1, 0, 0, '2026-03-23 18:09:46', '2026-03-23 18:09:46');

-- --------------------------------------------------------

--
-- Table structure for table `activity_logs`
--

CREATE TABLE IF NOT EXISTS `activity_logs` (
  `id` char(36) NOT NULL,
  `user_id` char(36) DEFAULT NULL,
  `user_name` varchar(255) DEFAULT NULL,
  `action` varchar(50) NOT NULL,
  `description` varchar(255) NOT NULL,
  `subject_type` varchar(255) DEFAULT NULL,
  `subject_id` char(36) DEFAULT NULL,
  `subject_label` varchar(255) DEFAULT NULL,
  `old_values` longtext CHARACTER SET utf8mb4 COLLATE utf8mb4_bin DEFAULT NULL CHECK (json_valid(`old_values`)),
  `new_values` longtext CHARACTER SET utf8mb4 COLLATE utf8mb4_bin DEFAULT NULL CHECK (json_valid(`new_values`)),
  `module` varchar(50) DEFAULT NULL,
  `ip_address` varchar(45) DEFAULT NULL,
  `user_agent` varchar(255) DEFAULT NULL,
  `created_at` timestamp NULL DEFAULT NULL,
  `updated_at` timestamp NULL DEFAULT NULL,
  PRIMARY KEY (`id`),
  KEY `activity_logs_user_id_index` (`user_id`),
  KEY `activity_logs_action_index` (`action`),
  KEY `activity_logs_subject_type_index` (`subject_type`),
  KEY `activity_logs_module_index` (`module`),
  KEY `activity_logs_created_at_index` (`created_at`),
  KEY `activity_logs_subject_type_subject_id_index` (`subject_type`,`subject_id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

--
-- RELATIONSHIPS FOR TABLE `activity_logs`:
--   `user_id`
--       `users` -> `id`
--

--
-- Dumping data for table `activity_logs`
--

INSERT INTO `activity_logs` (`id`, `user_id`, `user_name`, `action`, `description`, `subject_type`, `subject_id`, `subject_label`, `old_values`, `new_values`, `module`, `ip_address`, `user_agent`, `created_at`, `updated_at`) VALUES
('0ea867db-2790-41d0-81db-d67270760216', '3f99b231-2520-4c1b-939b-02022d36a06e', 'Root', 'created', 'Created document requirement Proof of Receipt', 'App\\Models\\DocumentRequirement', '453f9999-7cf7-47ba-9bcb-f98a7e40160b', 'Proof of Receipt', NULL, NULL, 'Document Requirements', '127.0.0.1', 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/146.0.0.0 Safari/537.36', '2026-03-23 18:42:12', '2026-03-23 18:42:12'),
('0f0a9189-a915-46db-aa95-7ce79be8a738', '3f99b231-2520-4c1b-939b-02022d36a06e', 'Root', 'updated', 'Updated document requirement Report of Cheque Issued', 'App\\Models\\DocumentRequirement', '3c4a4ee7-55b1-4655-b7de-9f38e20635ab', 'Report of Cheque Issued', '{\"Description\":null,\"Upload Message\":\"The Report of Cheques Issued must include all cheque numbers, payee names, and amounts. Please ensure all entries are accounted for.\"}', '{\"Description\":\"Report of Checks issued with supporting documents for ASC, signed by Disbursing Officer, approved by the Finance Officer or Authorized Official (Annex 9);\",\"Upload Message\":\"The attached report of checks issued, with supporting documents for ASC, must be signed by the Disbursing Officer and approved by the Finance Officer or Authorized Official (Annex 9) Proceed with upload?\"}', 'Document Requirements', '127.0.0.1', 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/146.0.0.0 Safari/537.36', '2026-03-23 08:04:48', '2026-03-23 08:04:48'),
('0fb3a049-85bd-413a-8d17-b74630eec62e', '3f99b231-2520-4c1b-939b-02022d36a06e', 'Root', 'updated', 'Updated program CMSP', 'App\\Models\\Program', '53c5c334-0a20-4f3e-a1e2-3ec0cd178540', 'CMSP', '{\"Description\":\"CHED MERIT SCHOLARSHIP PROGRAM (CMSP) LIQUIDATION CHECKLIST FOR AY 2025-2026 ONWARDS\"}', '{\"Description\":\"CHED MERIT SCHOLARSHIP PROGRAM (CMSP) LIQUIDATION CHECKLIST\"}', 'Programs', '127.0.0.1', 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/146.0.0.0 Safari/537.36', '2026-03-23 18:00:16', '2026-03-23 18:00:16'),
('10204e34-d45a-4ecb-8d87-4dd1e46f8df6', '3f99b231-2520-4c1b-939b-02022d36a06e', 'Root', 'updated', 'Updated document requirement Certificate of Registration with Assessment', 'App\\Models\\DocumentRequirement', '46404542-6ba2-4948-8bf3-cadddf7a9f2e', 'Certificate of Registration with Assessment', '{\"Description\":\"3. Original or certified true copy of Certificate of Registration with assessment\"}', '{\"Description\":\"Original or certified true copy of Certificate of Registration with assessment\"}', 'Document Requirements', '127.0.0.1', 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/146.0.0.0 Safari/537.36', '2026-03-23 17:52:40', '2026-03-23 17:52:40'),
('1228d40d-d4d2-4fe7-a727-2ffc66548653', '3f99b231-2520-4c1b-939b-02022d36a06e', 'Root', 'updated', 'Updated document requirement Report of Cheque Issued', 'App\\Models\\DocumentRequirement', 'a24165c6-e737-466a-9b63-ae28974e405e', 'Report of Cheque Issued', '{\"Description\":null,\"Upload Message\":\"The Report of Cheques Issued must include all cheque numbers, payee names, and amounts. Please ensure all entries are accounted for.\"}', '{\"Description\":\"Report of Checks issued with supporting documents for ASC, signed by Disbursing Officer, approved by the Finance Officer or Authorized Official (Annex 9);\",\"Upload Message\":\"The attached report of checks issued, with supporting documents for ASC, must be signed by the Disbursing Officer and approved by the Finance Officer or Authorized Official (Annex 9) Proceed with upload?\"}', 'Document Requirements', '127.0.0.1', 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/146.0.0.0 Safari/537.36', '2026-03-23 07:53:17', '2026-03-23 07:53:17'),
('139d4c1e-dac7-4c20-8174-8e44a02393ae', '3f99b231-2520-4c1b-939b-02022d36a06e', 'Root', 'updated', 'Updated document requirement Sharing Agreement or Annex 10', 'App\\Models\\DocumentRequirement', 'db72dc12-1e6f-47a7-ae9b-b30b18cc1e5c', 'Sharing Agreement or Annex 10', '{\"Description\":null,\"Upload Message\":\"The Sharing Agreement or Annex 10 must be duly signed by both parties. Please ensure the document is complete and legible.\"}', '{\"Description\":\"Sharing Agreement - Applicable for Academic Years  2018-2019 to 1st semester Academic Year 2021-2022\\r\\n\\r\\nAnnex 10: Certified List of Tertiary Education Subsidy (TES) Grantees with Notarized TES Sharing Agreement starting 2nd semester Academic Year 2021-2022 and onwards\\r\\n\\r\\nApplicable Batch: Batch 1 Grantees (P30,000.00 stipend)\",\"Upload Message\":\"Attach the signed sharing agreement, if applicable. Proceed with upload?\"}', 'Document Requirements', '127.0.0.1', 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/146.0.0.0 Safari/537.36', '2026-03-23 08:10:48', '2026-03-23 08:10:48'),
('15c4503d-e3c7-4295-b38e-c51604dafeea', '3f99b231-2520-4c1b-939b-02022d36a06e', 'Root', 'created', 'Created academic year 2026-2027', 'App\\Models\\AcademicYear', '8ccff753-4a05-45e5-a7c5-223a7dfbe357', '2026-2027', NULL, NULL, 'Settings', '127.0.0.1', 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/146.0.0.0 Safari/537.36', '2026-03-23 08:36:18', '2026-03-23 08:36:18'),
('1693e36c-6983-4a58-a224-d56fc6b8c2ce', '3f99b231-2520-4c1b-939b-02022d36a06e', 'Root', 'created', 'Created academic year 2024-2025', 'App\\Models\\AcademicYear', '8e1bbe6f-6c6f-4bc6-bc3b-4a15317b5cf5', '2024-2025', NULL, NULL, 'Settings', '127.0.0.1', 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/146.0.0.0 Safari/537.36', '2026-03-23 08:36:11', '2026-03-23 08:36:11'),
('1a23d8a1-aa4f-4b9b-8260-7946c9fcc63b', '3f99b231-2520-4c1b-939b-02022d36a06e', 'Root', 'updated', 'Updated document requirement Official Receipt for Refund', 'App\\Models\\DocumentRequirement', 'dabd44ff-b8e4-4d7e-a559-33b07a473f02', 'Official Receipt for Refund', '{\"Required\":true}', '{\"Required\":\"0\"}', 'Document Requirements', '127.0.0.1', 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/146.0.0.0 Safari/537.36', '2026-03-23 08:12:57', '2026-03-23 08:12:57'),
('1a2d2928-b856-4245-8fcd-5af4b521bb0b', '3f99b231-2520-4c1b-939b-02022d36a06e', 'Root', 'updated', 'Updated document requirement Fund Utilization Report', 'App\\Models\\DocumentRequirement', 'd736127f-5acc-41a2-a03b-a4b9ef65b70b', 'Fund Utilization Report', '{\"Upload Message\":\"The Fund Utilization Report (FUR) must be signed by the Accountant and the Head of the HEI. Please ensure all amounts are accurate and reconciled.\"}', '{\"Upload Message\":\"The attached Fund Utilization Report must be complete and duly signed by the authorized official of your HEI. Proceed with upload?\"}', 'Document Requirements', '127.0.0.1', 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/146.0.0.0 Safari/537.36', '2026-03-23 07:59:12', '2026-03-23 07:59:12'),
('1e7e379e-17ff-4969-8572-8f1ecc6950eb', '3f99b231-2520-4c1b-939b-02022d36a06e', 'Root', 'created', 'Created academic year 2023-2024', 'App\\Models\\AcademicYear', 'abfcf8d6-f64f-4bec-95a7-8f9c9e043538', '2023-2024', NULL, NULL, 'Settings', '127.0.0.1', 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/146.0.0.0 Safari/537.36', '2026-03-23 08:36:05', '2026-03-23 08:36:05'),
('201f5d9d-d848-4d38-b120-0565766a6093', '3f99b231-2520-4c1b-939b-02022d36a06e', 'Root', 'updated', 'Updated document requirement Official Receipt for Refund', 'App\\Models\\DocumentRequirement', 'eaf5d9a9-a916-44d5-b77f-702cfa77dd17', 'Official Receipt for Refund', '{\"Description\":null,\"Upload Message\":\"Please upload the Official Receipt (OR) for all refunded amounts. The OR must be issued by the HEI cashier or authorized officer.\"}', '{\"Description\":\"Attach scanned copy of refund for unutilized Adminisitrative Support Cost or unclaimed student-grantee\'s stipend\",\"Upload Message\":\"The attached scanned copy of refund for unutilized Administrative Support Cost or unclaimed student-grantee\'s stipend, must be complete and final, if any. Proceed with upload?\"}', 'Document Requirements', '127.0.0.1', 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/146.0.0.0 Safari/537.36', '2026-03-23 08:12:14', '2026-03-23 08:12:14'),
('231ff642-fd34-47a5-8801-6f0f890c9ac6', '3f99b231-2520-4c1b-939b-02022d36a06e', 'Root', 'created', 'Created document requirement Official Receipt of the utilized/returned ASC', 'App\\Models\\DocumentRequirement', '4da8b993-bd64-491c-b0a3-af9e15373635', 'Official Receipt of the utilized/returned ASC', NULL, NULL, 'Document Requirements', '127.0.0.1', 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/146.0.0.0 Safari/537.36', '2026-03-23 18:31:44', '2026-03-23 18:31:44'),
('24fa0d4c-083d-48af-828e-78a468d2bf50', '3f99b231-2520-4c1b-939b-02022d36a06e', 'Root', 'created', 'Created academic year 2025-2026', 'App\\Models\\AcademicYear', 'ca1f71bf-1a84-44b7-b905-bf1aacd8ce8a', '2025-2026', NULL, NULL, 'Settings', '127.0.0.1', 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/146.0.0.0 Safari/537.36', '2026-03-23 08:36:15', '2026-03-23 08:36:15'),
('271276b3-0ed8-472d-8ceb-4e9854a87494', '3f99b231-2520-4c1b-939b-02022d36a06e', 'Root', 'updated', 'Updated document requirement Official Receipt for Refund', 'App\\Models\\DocumentRequirement', 'dabd44ff-b8e4-4d7e-a559-33b07a473f02', 'Official Receipt for Refund', '{\"Description\":null,\"Upload Message\":\"Please upload the Official Receipt (OR) for all refunded amounts. The OR must be issued by the HEI cashier or authorized officer.\"}', '{\"Description\":\"Attach scanned copy of refund for unutilized Adminisitrative Support Cost or unclaimed student-grantee\'s stipend\",\"Upload Message\":\"The attached scanned copy of refund for unutilized Administrative Support Cost or unclaimed student-grantee\'s stipend, must be complete and final, if any. Proceed with upload?\"}', 'Document Requirements', '127.0.0.1', 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/146.0.0.0 Safari/537.36', '2026-03-23 07:56:19', '2026-03-23 07:56:19'),
('2a5242b7-42e0-47af-9afe-a825dc0fd70d', '3f99b231-2520-4c1b-939b-02022d36a06e', 'Root', 'created', 'Created program CoScho', 'App\\Models\\Program', 'c600e60e-9d72-48a6-9f50-710f468309fe', 'CoScho', NULL, NULL, 'Programs', '127.0.0.1', 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/146.0.0.0 Safari/537.36', '2026-03-23 08:32:35', '2026-03-23 08:32:35'),
('2cd7307f-c799-483d-a4c9-cf5392f3c40d', '3f99b231-2520-4c1b-939b-02022d36a06e', 'Root', 'updated', 'Updated document requirement Proof of Disbursement (General Payroll/Bank Transfer/Money Remittance)', 'App\\Models\\DocumentRequirement', 'ebafc361-2ee6-4b94-a706-59c6c9cb24da', 'Proof of Disbursement (General Payroll/Bank Transfer/Money Remittance)', '{\"Upload Message\":\"Please upload proof of disbursement such as General Payroll, Bank Transfer confirmation, or Money Remittance receipts. All beneficiaries must be accounted for.\"}', '{\"Upload Message\":\"The attached proof of Disbursement (General Payroll \\/ Bank Transfer \\/ Money Remittance) must be complete and duly signed. Proceed with upload?\"}', 'Document Requirements', '127.0.0.1', 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/146.0.0.0 Safari/537.36', '2026-03-23 08:05:20', '2026-03-23 08:05:20'),
('3171e3db-e52f-49bc-9d89-a912bad27c20', '3f99b231-2520-4c1b-939b-02022d36a06e', 'Root', 'updated', 'Updated document requirement Billing Documents', 'App\\Models\\DocumentRequirement', '282f90cd-7af5-421b-91df-78bda9658c6c', 'Billing Documents', '{\"Description\":null,\"Upload Message\":\"Please upload billing documents including Statement of Account (SOA) and other supporting billing records.\"}', '{\"Description\":\"Attach the updated Billing documents received from CHED\'s Cashier\'s Office\",\"Upload Message\":\"The attached updated billing documents must be received from CHED\'s Cashier\'s Office. Proceed with upload?\"}', 'Document Requirements', '127.0.0.1', 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/146.0.0.0 Safari/537.36', '2026-03-23 07:54:41', '2026-03-23 07:54:41'),
('40267148-e483-42d8-9d35-7cb879489d16', '3f99b231-2520-4c1b-939b-02022d36a06e', 'Root', 'created', 'Created program MSRS', 'App\\Models\\Program', '49f6eb41-cd42-4359-b2b2-f0895af7c383', 'MSRS', NULL, NULL, 'Programs', '127.0.0.1', 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/146.0.0.0 Safari/537.36', '2026-03-23 18:32:32', '2026-03-23 18:32:32'),
('431f65f1-8e40-4e27-9c0e-05279536fde4', '3f99b231-2520-4c1b-939b-02022d36a06e', 'Root', 'created', 'Created document requirement Valid Identification Card', 'App\\Models\\DocumentRequirement', '23c1166c-188a-41b1-9a08-7ee366ab96b3', 'Valid Identification Card', NULL, NULL, 'Document Requirements', '127.0.0.1', 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/146.0.0.0 Safari/537.36', '2026-03-23 17:54:02', '2026-03-23 17:54:02'),
('4491a130-9a1b-4766-9a75-76e3a0ff2eda', '3f99b231-2520-4c1b-939b-02022d36a06e', 'Root', 'created', 'Created academic year 2022-2023', 'App\\Models\\AcademicYear', 'f5c831f2-2e08-44d1-b479-766ce2b24d9e', '2022-2023', NULL, NULL, 'Settings', '127.0.0.1', 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/146.0.0.0 Safari/537.36', '2026-03-23 08:36:00', '2026-03-23 08:36:00'),
('4a9bab4f-605d-4fd1-9e7a-9b9afeb057e2', '3f99b231-2520-4c1b-939b-02022d36a06e', 'Root', 'created', 'Created document requirement Certificate of Grades', 'App\\Models\\DocumentRequirement', '86c6dd91-7759-4b56-8ead-6b94d3f38a21', 'Certificate of Grades', NULL, NULL, 'Document Requirements', '127.0.0.1', 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/146.0.0.0 Safari/537.36', '2026-03-23 18:29:25', '2026-03-23 18:29:25'),
('4b1e76e6-a028-408b-b137-a5527b98d315', '3f99b231-2520-4c1b-939b-02022d36a06e', 'Root', 'updated', 'Updated document requirement Official Receipt for the use of ASC or Management Fee', 'App\\Models\\DocumentRequirement', 'd8a238fc-bcb6-4b75-a1a8-95633848195f', 'Official Receipt for the use of ASC or Management Fee', '{\"Description\":null,\"Upload Message\":\"Please upload the Official Receipt (OR) issued by the HEI for the Administrative Service Charge (ASC) or Management Fee deducted from the fund.\"}', '{\"Description\":\"Administrative Support Cost (ASC)\\r\\nThe ASC for HEIs, shall cover expenses on monitoring, notarization of legal documents, office supplies and materials, hiring of project technical staff\\/s or job order, communication, transportation \\/ travel, remedial \\/ mentoring program and meetings \\/ orientation \\/ general assembly and cash cards that will be issued to the TES student-grantees. Also, see Memorandum Circular No. 3 series of 2024 for the detailed allowable expenses and required attachments.\\r\\n\\r\\n\\r\\nManagement Fee\\r\\nOfficial receipt issued by the HEI duly signed by the  Finance Officer or Authorized Official of the  HEI for the receipt of fund (Effective starting Academic Year 2024-2025 and onwards)\",\"Upload Message\":\"The attached Official Receipt and other supporting documents for the ASC or Management Fee must be complete and duly signed\\/authorized. Proceed with.\"}', 'Document Requirements', '127.0.0.1', 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/146.0.0.0 Safari/537.36', '2026-03-23 07:52:54', '2026-03-23 07:52:54'),
('52a55538-a0f1-435a-9f2f-ab57611f3047', '3f99b231-2520-4c1b-939b-02022d36a06e', 'Root', 'created', 'Created document requirement Statement of Account (SOA)', 'App\\Models\\DocumentRequirement', 'a08bd7c1-dd0d-423e-b55b-98db91045c7c', 'Statement of Account (SOA)', NULL, NULL, 'Document Requirements', '127.0.0.1', 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/146.0.0.0 Safari/537.36', '2026-03-23 18:48:35', '2026-03-23 18:48:35'),
('533438e0-5965-463f-8a06-75be29743e4e', '3f99b231-2520-4c1b-939b-02022d36a06e', 'Root', 'created', 'Created document requirement Certificate of Enrollment (COE) or Certificate of Registration (COR)', 'App\\Models\\DocumentRequirement', '7fa257b3-1e2c-4342-b183-15340f845b28', 'Certificate of Enrollment (COE) or Certificate of Registration (COR)', NULL, NULL, 'Document Requirements', '127.0.0.1', 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/146.0.0.0 Safari/537.36', '2026-03-23 18:47:10', '2026-03-23 18:47:10'),
('5559206b-8b24-441b-bd9e-c73c716fcd89', '3f99b231-2520-4c1b-939b-02022d36a06e', 'Root', 'created', 'Created program CHED TDP', 'App\\Models\\Program', 'd167bed7-fd80-4936-b014-6210584205ba', 'CHED TDP', NULL, NULL, 'Programs', '127.0.0.1', 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/146.0.0.0 Safari/537.36', '2026-03-23 18:18:52', '2026-03-23 18:18:52'),
('5bec38e4-84e4-45fc-9c1a-85f5a153d86e', '3f99b231-2520-4c1b-939b-02022d36a06e', 'Root', 'updated', 'Updated document requirement School Identification Card', 'App\\Models\\DocumentRequirement', 'a29714f5-21e0-4926-ad63-ab51baf809a6', 'School Identification Card', '{\"Description\":null,\"Upload Message\":\"Please upload scanned copies of School IDs for all beneficiaries. Ensure that photos and details are clearly visible.\"}', '{\"Description\":\"Must have three (3) specimen signatures of the student-grantee. Specimen signatures must be the same signature appearing in the student-grantee\'s school ID\",\"Upload Message\":\"The attached ID must have 3 specimen signatures of the student-grantee, same as on the school ID. Proceed with upload?\"}', 'Document Requirements', '127.0.0.1', 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/146.0.0.0 Safari/537.36', '2026-03-23 07:56:00', '2026-03-23 07:56:00'),
('5c21126e-aca9-4f48-935a-d68e82a020a8', '3f99b231-2520-4c1b-939b-02022d36a06e', 'Root', 'created', 'Created document requirement School Identification Card', 'App\\Models\\DocumentRequirement', '4e26cc68-d3c6-4734-922f-90aba7944d2e', 'School Identification Card', NULL, NULL, 'Document Requirements', '127.0.0.1', 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/146.0.0.0 Safari/537.36', '2026-03-23 18:30:39', '2026-03-23 18:30:39'),
('66634fb8-6d53-471a-8474-4862b83c38af', '3f99b231-2520-4c1b-939b-02022d36a06e', 'Root', 'updated', 'Updated document requirement Official Receipt for Refund', 'App\\Models\\DocumentRequirement', 'eaf5d9a9-a916-44d5-b77f-702cfa77dd17', 'Official Receipt for Refund', '{\"Required\":true}', '{\"Required\":\"0\"}', 'Document Requirements', '127.0.0.1', 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/146.0.0.0 Safari/537.36', '2026-03-23 08:12:47', '2026-03-23 08:12:47'),
('6a9bbb8b-757e-43e5-9b58-11f09ae08139', '3f99b231-2520-4c1b-939b-02022d36a06e', 'Root', 'created', 'Created document requirement Liquidation Report Form', 'App\\Models\\DocumentRequirement', '6570c333-2559-4758-b402-70945883137b', 'Liquidation Report Form', NULL, NULL, 'Document Requirements', '127.0.0.1', 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/146.0.0.0 Safari/537.36', '2026-03-23 17:58:47', '2026-03-23 17:58:47'),
('7b17295a-4b14-4cfe-b807-e533b494c749', '3f99b231-2520-4c1b-939b-02022d36a06e', 'Root', 'updated', 'Updated document requirement Official Receipt for the use of ASC or Management Fee', 'App\\Models\\DocumentRequirement', '4b3425e8-d51a-416e-966d-6f158af26f29', 'Official Receipt for the use of ASC or Management Fee', '{\"Upload Message\":\"The attached Official Receipt and other supporting documents for the ASC or Management Fee must be complete and duly signed\\/authorized.\"}', '{\"Upload Message\":\"The attached Official Receipt and other supporting documents for the ASC or Management Fee must be complete and duly signed\\/authorized. Proceed with upload?\"}', 'Document Requirements', '127.0.0.1', 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/146.0.0.0 Safari/537.36', '2026-03-23 08:00:31', '2026-03-23 08:00:31'),
('7baaba04-a072-42d6-8fae-333f57e59124', '3f99b231-2520-4c1b-939b-02022d36a06e', 'Root', 'updated', 'Updated document requirement Certificate of Registration/Certificate of Enrollment', 'App\\Models\\DocumentRequirement', '9ac380da-211a-495a-b069-b6fb437f96a9', 'Certificate of Registration/Certificate of Enrollment', '{\"Description\":null,\"Upload Message\":\"Please upload the Certificate of Registration (COR) or Certificate of Enrollment (COE) for all beneficiaries listed in the liquidation.\"}', '{\"Description\":\"Attach the final Certificate of Registration\\/Certificate of Enrollment\",\"Upload Message\":\"The attached Certificate of Registration\\/Certificate of Enrollment must be final. Proceed with upload?\"}', 'Document Requirements', '127.0.0.1', 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/146.0.0.0 Safari/537.36', '2026-03-23 08:10:06', '2026-03-23 08:10:06'),
('7e9743f0-fadb-4e71-8e19-843d369c4cc6', '3f99b231-2520-4c1b-939b-02022d36a06e', 'Root', 'created', 'Created document requirement Transmittal letter', 'App\\Models\\DocumentRequirement', 'f0ac0a3b-2a44-405d-bd82-bc9801a782cd', 'Transmittal letter', NULL, NULL, 'Document Requirements', '127.0.0.1', 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/146.0.0.0 Safari/537.36', '2026-03-23 18:41:27', '2026-03-23 18:41:27'),
('7f865aa4-af46-41ad-bfa6-f1acabd09157', '3f99b231-2520-4c1b-939b-02022d36a06e', 'Root', 'created', 'Created document requirement Billing Form', 'App\\Models\\DocumentRequirement', 'fe119d28-021f-4e73-8b62-35183c4a3c4c', 'Billing Form', NULL, NULL, 'Document Requirements', '127.0.0.1', 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/146.0.0.0 Safari/537.36', '2026-03-23 18:01:38', '2026-03-23 18:01:38'),
('84545dde-edc7-4411-a957-c0c8007a4337', '3f99b231-2520-4c1b-939b-02022d36a06e', 'Root', 'created', 'Created document requirement Signed Payroll', 'App\\Models\\DocumentRequirement', 'aa614ab6-2830-4071-bd72-e1a969142238', 'Signed Payroll', NULL, NULL, 'Document Requirements', '127.0.0.1', 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/146.0.0.0 Safari/537.36', '2026-03-23 18:50:48', '2026-03-23 18:50:48'),
('8a627649-91cb-4ed8-8a28-0707faa67734', '3f99b231-2520-4c1b-939b-02022d36a06e', 'Root', 'created', 'Created program Student Financial Assistance Programs', 'App\\Models\\Program', '770e9ade-3cf8-4e1b-9a45-1852c7292a0c', 'Student Financial Assistance Programs', NULL, NULL, 'Programs', '127.0.0.1', 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/146.0.0.0 Safari/537.36', '2026-03-23 08:30:48', '2026-03-23 08:30:48'),
('8ae63182-77ab-455f-91da-c17af7b8b4f2', '3f99b231-2520-4c1b-939b-02022d36a06e', 'Root', 'updated', 'Updated document requirement Fund Utilization Report', 'App\\Models\\DocumentRequirement', 'dc5c6336-c1c4-4b23-9f6e-d0ab388337d9', 'Fund Utilization Report', '{\"Upload Message\":\"The Fund Utilization Report (FUR) must be signed by the Accountant and the Head of the HEI. Please ensure all amounts are accurate and reconciled.\"}', '{\"Upload Message\":\"The attached Fund Utilization Report must be complete and duly signed by the authorized official of your HEI. Proceed with upload?\"}', 'Document Requirements', '127.0.0.1', 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/146.0.0.0 Safari/537.36', '2026-03-23 07:48:55', '2026-03-23 07:48:55'),
('8b020f28-9b37-4825-a7d7-1b1cecb3510c', '3f99b231-2520-4c1b-939b-02022d36a06e', 'Root', 'created', 'Created academic year 2021-2022', 'App\\Models\\AcademicYear', '49d1f639-83b8-42dc-82e8-bf8f15e6bb77', '2021-2022', NULL, NULL, 'Settings', '127.0.0.1', 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/146.0.0.0 Safari/537.36', '2026-03-23 08:35:49', '2026-03-23 08:35:49'),
('8e82c6df-68ca-4f98-b3d0-e18d757ab0b7', '3f99b231-2520-4c1b-939b-02022d36a06e', 'Root', 'updated', 'Updated program CMSP', 'App\\Models\\Program', '53c5c334-0a20-4f3e-a1e2-3ec0cd178540', 'CMSP', '{\"Description\":\"CHED MERIT SCHOLARSHIP PROGRAM (CMSP) LIQUIDATION CHECKLIST\"}', '{\"Description\":\"CHED Merit Scholarship Program\"}', 'Programs', '127.0.0.1', 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/146.0.0.0 Safari/537.36', '2026-03-23 18:19:08', '2026-03-23 18:19:08'),
('8f214d92-0754-48b8-8b6e-8cb5cd8bab2c', '3f99b231-2520-4c1b-939b-02022d36a06e', 'Root', 'updated', 'Updated document requirement Official Receipt for the use of ASC or Management Fee', 'App\\Models\\DocumentRequirement', 'd8a238fc-bcb6-4b75-a1a8-95633848195f', 'Official Receipt for the use of ASC or Management Fee', '{\"Upload Message\":\"The attached Official Receipt and other supporting documents for the ASC or Management Fee must be complete and duly signed\\/authorized. Proceed with.\"}', '{\"Upload Message\":\"The attached Official Receipt and other supporting documents for the ASC or Management Fee must be complete and duly signed\\/authorized. Proceed with upload?\"}', 'Document Requirements', '127.0.0.1', 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/146.0.0.0 Safari/537.36', '2026-03-23 08:00:14', '2026-03-23 08:00:14'),
('9d2a7dce-52a9-47b2-b5b2-4bcf0a1423b8', '3f99b231-2520-4c1b-939b-02022d36a06e', 'Root', 'created', 'Created document requirement General Payroll (Billing)', 'App\\Models\\DocumentRequirement', '0f66c9bd-3044-4f6a-9222-f16e1b5f350f', 'General Payroll (Billing)', NULL, NULL, 'Document Requirements', '127.0.0.1', 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/146.0.0.0 Safari/537.36', '2026-03-23 17:49:45', '2026-03-23 17:49:45'),
('a16a085a-999e-4207-876f-82e85b6f7f7f', '3f99b231-2520-4c1b-939b-02022d36a06e', 'Root', 'updated', 'Updated document requirement Transmittal', 'App\\Models\\DocumentRequirement', '1dabc9ff-051e-4b82-a24d-d3272dd369b4', 'Transmittal', '{\"Description\":null,\"Upload Message\":\"The attached transmittal letter must be duly signed by the President\\/Head of your HEI. Please ensure all signatures are complete before uploading.\"}', '{\"Description\":\"Should be duly signed by the president or head of HEI\",\"Upload Message\":\"The attached transmittal letter must be duly signed by the President\\/Head of your HEI. Proceed with upload?\"}', 'Document Requirements', '127.0.0.1', 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/146.0.0.0 Safari/537.36', '2026-03-23 07:48:05', '2026-03-23 07:48:05'),
('a397359d-2a9a-45cf-b3c6-4bf571deb9b8', '3f99b231-2520-4c1b-939b-02022d36a06e', 'Root', 'updated', 'Updated document requirement Proof of Disbursement (General Payroll/Bank Transfer/Money Remittance)', 'App\\Models\\DocumentRequirement', 'ec1b84ca-dd76-456b-b832-91336f6ca7a4', 'Proof of Disbursement (General Payroll/Bank Transfer/Money Remittance)', '{\"Upload Message\":\"Please upload proof of disbursement such as General Payroll, Bank Transfer confirmation, or Money Remittance receipts. All beneficiaries must be accounted for.\"}', '{\"Upload Message\":\"The attached proof of Disbursement (General Payroll \\/ Bank Transfer \\/ Money Remittance) must be complete and duly signed. Proceed with upload?\"}', 'Document Requirements', '127.0.0.1', 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/146.0.0.0 Safari/537.36', '2026-03-23 07:54:01', '2026-03-23 07:54:01'),
('acc1a7b2-476b-438a-8fb5-99777de303fb', '3f99b231-2520-4c1b-939b-02022d36a06e', 'Root', 'updated', 'Updated document requirement Sharing Agreement or Annex 10', 'App\\Models\\DocumentRequirement', '7b7dbdc9-f76a-4438-8c0f-1078d37a4ea9', 'Sharing Agreement or Annex 10', '{\"Description\":null,\"Upload Message\":\"The Sharing Agreement or Annex 10 must be duly signed by both parties. Please ensure the document is complete and legible.\"}', '{\"Description\":\"Sharing Agreement - Applicable for Academic Years  2018-2019 to 1st semester Academic Year 2021-2022\\r\\n\\r\\nAnnex 10: Certified List of Tertiary Education Subsidy (TES) Grantees with Notarized TES Sharing Agreement starting 2nd semester Academic Year 2021-2022 and onwards\\r\\n\\r\\nApplicable Batch: Batch 1 Grantees (P30,000.00 stipend)\",\"Upload Message\":\"Attach the signed sharing agreement, if applicable. Proceed with upload?\"}', 'Document Requirements', '127.0.0.1', 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/146.0.0.0 Safari/537.36', '2026-03-23 07:55:41', '2026-03-23 07:55:41'),
('b4716970-16ee-4687-a8d0-25fc46b1f7d8', '3f99b231-2520-4c1b-939b-02022d36a06e', 'Root', 'created', 'Created program ACEF-GIAHEP', 'App\\Models\\Program', 'df19c886-3e3b-44c9-89ae-d682ec2982d2', 'ACEF-GIAHEP', NULL, NULL, 'Programs', '127.0.0.1', 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/146.0.0.0 Safari/537.36', '2026-03-23 18:22:35', '2026-03-23 18:22:35'),
('b99b577e-87f3-40f8-85ef-9b0fe4c69c31', '3f99b231-2520-4c1b-939b-02022d36a06e', 'Root', 'created', 'Created academic year 2020-2021', 'App\\Models\\AcademicYear', '09dcdab0-28ba-4c30-a85a-187177a4e114', '2020-2021', NULL, NULL, 'Settings', '127.0.0.1', 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/146.0.0.0 Safari/537.36', '2026-03-23 08:35:39', '2026-03-23 08:35:39'),
('bb737315-d670-477e-be83-ecb96654a752', '3f99b231-2520-4c1b-939b-02022d36a06e', 'Root', 'updated', 'Updated document requirement Transmittal', 'App\\Models\\DocumentRequirement', 'c2c04aed-ccef-4765-bee9-b4057395ce76', 'Transmittal', '{\"Description\":null,\"Upload Message\":\"The attached transmittal letter must be duly signed by the President\\/Head of your HEI. Please ensure all signatures are complete before uploading.\"}', '{\"Description\":\"Should be duly signed by the president or head of HEI\",\"Upload Message\":\"The attached transmittal letter must be duly signed by the President\\/Head of your HEI. Proceed with upload?\"}', 'Document Requirements', '127.0.0.1', 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/146.0.0.0 Safari/537.36', '2026-03-23 07:58:52', '2026-03-23 07:58:52'),
('bf7c96b0-c620-4723-99f2-88dc50731ad1', '3f99b231-2520-4c1b-939b-02022d36a06e', 'Root', 'created', 'Created document requirement Signed Payroll or Proof of Receipt', 'App\\Models\\DocumentRequirement', 'e52a0bb3-17a0-459b-9ac9-e566f8d4b1cb', 'Signed Payroll or Proof of Receipt', NULL, NULL, 'Document Requirements', '127.0.0.1', 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/146.0.0.0 Safari/537.36', '2026-03-23 18:30:00', '2026-03-23 18:30:00'),
('c4624a65-c3b1-4644-9a54-e12be7290880', NULL, 'System', 'created', 'Created user Root', 'App\\Models\\User', '3f99b231-2520-4c1b-939b-02022d36a06e', 'Root', NULL, NULL, 'User Management', '127.0.0.1', 'Symfony', '2026-03-23 02:18:38', '2026-03-23 02:18:38'),
('c5375fd9-91b3-4f77-9da6-ad7894131e24', '3f99b231-2520-4c1b-939b-02022d36a06e', 'Root', 'created', 'Created document requirement Billing Form', 'App\\Models\\DocumentRequirement', '6b241d51-09ba-4f02-bebc-0da093477e82', 'Billing Form', NULL, NULL, 'Document Requirements', '127.0.0.1', 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/146.0.0.0 Safari/537.36', '2026-03-23 18:20:19', '2026-03-23 18:20:19'),
('c67d193b-3cf7-4869-8691-fb727740db9c', '3f99b231-2520-4c1b-939b-02022d36a06e', 'Root', 'created', 'Created document requirement Financial Status Report', 'App\\Models\\DocumentRequirement', '0585ec54-74c2-4a3f-94e3-2c54a20e1ed5', 'Financial Status Report', NULL, NULL, 'Document Requirements', '127.0.0.1', 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/146.0.0.0 Safari/537.36', '2026-03-23 17:49:02', '2026-03-23 17:49:02'),
('ca327b9f-f432-4ad7-a45d-54c0ee11458f', '3f99b231-2520-4c1b-939b-02022d36a06e', 'Root', 'created', 'Created document requirement Billing Form', 'App\\Models\\DocumentRequirement', 'c9f11a82-5949-4d2b-bff1-4f71988928df', 'Billing Form', NULL, NULL, 'Document Requirements', '127.0.0.1', 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/146.0.0.0 Safari/537.36', '2026-03-23 18:23:22', '2026-03-23 18:23:22'),
('d25bd04d-58f2-4c2b-ac04-b9d0e5ab0c42', '3f99b231-2520-4c1b-939b-02022d36a06e', 'Root', 'created', 'Created document requirement Certificate of Grades', 'App\\Models\\DocumentRequirement', '337fba6a-a69c-4c5b-bbfd-a5b557a1c637', 'Certificate of Grades', NULL, NULL, 'Document Requirements', '127.0.0.1', 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/146.0.0.0 Safari/537.36', '2026-03-23 17:53:16', '2026-03-23 17:53:16'),
('d48c2713-186c-4ef0-aee0-418983faf04d', '3f99b231-2520-4c1b-939b-02022d36a06e', 'Root', 'created', 'Created document requirement School Identification Card', 'App\\Models\\DocumentRequirement', '4ddc8d41-c06a-4b66-b57e-eb33e9ddf765', 'School Identification Card', NULL, NULL, 'Document Requirements', '127.0.0.1', 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/146.0.0.0 Safari/537.36', '2026-03-23 18:45:56', '2026-03-23 18:45:56'),
('da1210aa-2a84-42b5-9450-3250f9be48ba', '3f99b231-2520-4c1b-939b-02022d36a06e', 'Root', 'created', 'Created program CMSP', 'App\\Models\\Program', '53c5c334-0a20-4f3e-a1e2-3ec0cd178540', 'CMSP', NULL, NULL, 'Programs', '127.0.0.1', 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/146.0.0.0 Safari/537.36', '2026-03-23 17:56:59', '2026-03-23 17:56:59'),
('da81bbfc-fa6e-4b2f-a834-be05ab39cf12', '3f99b231-2520-4c1b-939b-02022d36a06e', 'Root', 'created', 'Created document requirement Certificate of Enrollment (COE) or Certificate of Registration (COR)', 'App\\Models\\DocumentRequirement', '360a3e45-0b60-4b0f-ab72-07dd2112c00d', 'Certificate of Enrollment (COE) or Certificate of Registration (COR)', NULL, NULL, 'Document Requirements', '127.0.0.1', 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/146.0.0.0 Safari/537.36', '2026-03-23 18:28:54', '2026-03-23 18:28:54'),
('de6de57c-b33a-46d8-ae72-48bcb48c041e', '3f99b231-2520-4c1b-939b-02022d36a06e', 'Root', 'updated', 'Updated document requirement School Identification Card', 'App\\Models\\DocumentRequirement', '4d5427d5-6c7f-4de0-a9e7-b29930e44091', 'School Identification Card', '{\"Description\":null,\"Upload Message\":\"Please upload scanned copies of School IDs for all beneficiaries. Ensure that photos and details are clearly visible.\"}', '{\"Description\":\"Must have three (3) specimen signatures of the student-grantee. Specimen signatures must be the same signature appearing in the student-grantee\'s school ID\",\"Upload Message\":\"The attached ID must have 3 specimen signatures of the student-grantee, same as on the school ID. Proceed with upload?\"}', 'Document Requirements', '127.0.0.1', 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/146.0.0.0 Safari/537.36', '2026-03-23 08:11:43', '2026-03-23 08:11:43'),
('dee3ed4f-3af7-4156-aec1-17013ee3fd24', '3f99b231-2520-4c1b-939b-02022d36a06e', 'Root', 'updated', 'Updated document requirement Official Receipt for the use of ASC or Management Fee', 'App\\Models\\DocumentRequirement', '4b3425e8-d51a-416e-966d-6f158af26f29', 'Official Receipt for the use of ASC or Management Fee', '{\"Description\":null,\"Upload Message\":\"Please upload the Official Receipt (OR) issued by the HEI for the Administrative Service Charge (ASC) or Management Fee deducted from the fund.\"}', '{\"Description\":\"Administrative Support Cost (ASC)\\r\\nThe ASC for HEIs, shall cover expenses on monitoring, notarization of legal documents, office supplies and materials, hiring of project technical staff\\/s or job order, communication, transportation \\/ travel, remedial \\/ mentoring program and meetings \\/ orientation \\/ general assembly and cash cards that will be issued to the TES student-grantees. Also, see Memorandum Circular No. 3 series of 2024 for the detailed allowable expenses and required attachments.\\r\\n\\r\\n\\r\\nManagement Fee\\r\\nOfficial receipt issued by the HEI duly signed by the  Finance Officer or Authorized Official of the  HEI for the receipt of fund (Effective starting Academic Year 2024-2025 and onwards)\",\"Upload Message\":\"The attached Official Receipt and other supporting documents for the ASC or Management Fee must be complete and duly signed\\/authorized.\"}', 'Document Requirements', '127.0.0.1', 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/146.0.0.0 Safari/537.36', '2026-03-23 08:00:01', '2026-03-23 08:00:01'),
('e023097e-1312-4b7e-b89b-ec8d268e37b8', '3f99b231-2520-4c1b-939b-02022d36a06e', 'Root', 'created', 'Created program SIDA-SGP', 'App\\Models\\Program', 'b92ec35b-6304-4e1b-a149-aa3330219fb4', 'SIDA-SGP', NULL, NULL, 'Programs', '127.0.0.1', 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/146.0.0.0 Safari/537.36', '2026-03-23 18:25:40', '2026-03-23 18:25:40'),
('e33256c0-eb14-48c8-b6a7-9f96aca7a2b8', '3f99b231-2520-4c1b-939b-02022d36a06e', 'Root', 'updated', 'Updated document requirement Certificate of Registration/Certificate of Enrollment', 'App\\Models\\DocumentRequirement', 'a26a22ac-a144-4194-9a20-dc853d01d88e', 'Certificate of Registration/Certificate of Enrollment', '{\"Description\":null,\"Upload Message\":\"Please upload the Certificate of Registration (COR) or Certificate of Enrollment (COE) for all beneficiaries listed in the liquidation.\"}', '{\"Description\":\"Attach the final Certificate of Registration\\/Certificate of Enrollment\",\"Upload Message\":\"The attached Certificate of Registration\\/Certificate of Enrollment must be final. Proceed with upload?\"}', 'Document Requirements', '127.0.0.1', 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/146.0.0.0 Safari/537.36', '2026-03-23 07:55:15', '2026-03-23 07:55:15'),
('ec1ef9d6-06ad-4df3-8d84-d2ef901c3a97', '3f99b231-2520-4c1b-939b-02022d36a06e', 'Root', 'updated', 'Updated program SIDA-SGP', 'App\\Models\\Program', 'b92ec35b-6304-4e1b-a149-aa3330219fb4', 'SIDA-SGP', '{\"Parent Program\":null}', '{\"Parent Program\":\"Student Financial Assistance Programs\"}', 'Programs', '127.0.0.1', 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/146.0.0.0 Safari/537.36', '2026-03-23 18:25:46', '2026-03-23 18:25:46'),
('f6ba0538-13a1-4289-9411-d55c09e70507', '3f99b231-2520-4c1b-939b-02022d36a06e', 'Root', 'updated', 'Updated document requirement Billing Documents', 'App\\Models\\DocumentRequirement', '78795877-358b-4cab-a317-f2f8e1624670', 'Billing Documents', '{\"Description\":null,\"Upload Message\":\"Please upload billing documents including Statement of Account (SOA) and other supporting billing records.\"}', '{\"Description\":\"Attach the updated Billing documents received from CHED\'s Cashier\'s Office\",\"Upload Message\":\"The attached updated billing documents must be received from CHED\'s Cashier\'s Office. Proceed with upload?\"}', 'Document Requirements', '127.0.0.1', 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/146.0.0.0 Safari/537.36', '2026-03-23 08:09:48', '2026-03-23 08:09:48'),
('f7148f10-8cb2-4c2e-bdfa-681df7c94dfd', '3f99b231-2520-4c1b-939b-02022d36a06e', 'Root', 'created', 'Created document requirement Certificate of Registration with Assessment', 'App\\Models\\DocumentRequirement', '46404542-6ba2-4948-8bf3-cadddf7a9f2e', 'Certificate of Registration with Assessment', NULL, NULL, 'Document Requirements', '127.0.0.1', 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/146.0.0.0 Safari/537.36', '2026-03-23 17:52:30', '2026-03-23 17:52:30'),
('f727705a-1dfb-494b-a691-e2c2ac90a3f6', '3f99b231-2520-4c1b-939b-02022d36a06e', 'Root', 'updated', 'Updated document requirement Fund Utilization Report', 'App\\Models\\DocumentRequirement', 'dc5c6336-c1c4-4b23-9f6e-d0ab388337d9', 'Fund Utilization Report', NULL, NULL, 'Document Requirements', '127.0.0.1', 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/146.0.0.0 Safari/537.36', '2026-03-23 07:48:31', '2026-03-23 07:48:31'),
('f9a8f447-f32d-4c11-8f34-6608151a497a', '3f99b231-2520-4c1b-939b-02022d36a06e', 'Root', 'created', 'Created document requirement Official Receipt of the utilized/returned ASC', 'App\\Models\\DocumentRequirement', '0b6189d2-937c-4819-a8ea-2b528e711489', 'Official Receipt of the utilized/returned ASC', NULL, NULL, 'Document Requirements', '127.0.0.1', 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/146.0.0.0 Safari/537.36', '2026-03-23 17:54:43', '2026-03-23 17:54:43'),
('fccee6fe-2ec9-41eb-bdaf-6386c8c9d30d', '3f99b231-2520-4c1b-939b-02022d36a06e', 'Root', 'created', 'Created document requirement Transmittal', 'App\\Models\\DocumentRequirement', 'f08af5fd-87b5-49c4-90d7-62d8ff01b9d7', 'Transmittal', NULL, NULL, 'Document Requirements', '127.0.0.1', 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/146.0.0.0 Safari/537.36', '2026-03-23 17:57:56', '2026-03-23 17:57:56');

-- --------------------------------------------------------

--
-- Table structure for table `cache`
--

CREATE TABLE IF NOT EXISTS `cache` (
  `key` varchar(255) NOT NULL,
  `value` mediumtext NOT NULL,
  `expiration` int(11) NOT NULL,
  PRIMARY KEY (`key`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

--
-- RELATIONSHIPS FOR TABLE `cache`:
--

--
-- Dumping data for table `cache`
--

INSERT INTO `cache` (`key`, `value`, `expiration`) VALUES
('laravel-cache-e1ca2b46dd626d5a2a8a32271a0d9b73', 'i:1;', 1774318691),
('laravel-cache-e1ca2b46dd626d5a2a8a32271a0d9b73:timer', 'i:1774318691;', 1774318691),
('laravel-cache-liquidation_status:code:VOIDED', 'O:28:\"App\\Models\\LiquidationStatus\":33:{s:13:\"\0*\0connection\";s:5:\"mysql\";s:8:\"\0*\0table\";s:20:\"liquidation_statuses\";s:13:\"\0*\0primaryKey\";s:2:\"id\";s:10:\"\0*\0keyType\";s:3:\"int\";s:12:\"incrementing\";b:1;s:7:\"\0*\0with\";a:0:{}s:12:\"\0*\0withCount\";a:0:{}s:19:\"preventsLazyLoading\";b:0;s:10:\"\0*\0perPage\";i:15;s:6:\"exists\";b:1;s:18:\"wasRecentlyCreated\";b:0;s:28:\"\0*\0escapeWhenCastingToString\";b:0;s:13:\"\0*\0attributes\";a:9:{s:2:\"id\";s:36:\"f6061e5f-9b73-4d5b-a252-949aa0f41ec0\";s:4:\"code\";s:6:\"VOIDED\";s:4:\"name\";s:6:\"Voided\";s:11:\"description\";s:42:\"Record has been voided by an administrator\";s:11:\"badge_color\";s:4:\"gray\";s:10:\"sort_order\";i:99;s:9:\"is_active\";i:1;s:10:\"created_at\";s:19:\"2026-03-23 10:17:43\";s:10:\"updated_at\";s:19:\"2026-03-23 10:17:43\";}s:11:\"\0*\0original\";a:9:{s:2:\"id\";s:36:\"f6061e5f-9b73-4d5b-a252-949aa0f41ec0\";s:4:\"code\";s:6:\"VOIDED\";s:4:\"name\";s:6:\"Voided\";s:11:\"description\";s:42:\"Record has been voided by an administrator\";s:11:\"badge_color\";s:4:\"gray\";s:10:\"sort_order\";i:99;s:9:\"is_active\";i:1;s:10:\"created_at\";s:19:\"2026-03-23 10:17:43\";s:10:\"updated_at\";s:19:\"2026-03-23 10:17:43\";}s:10:\"\0*\0changes\";a:0:{}s:11:\"\0*\0previous\";a:0:{}s:8:\"\0*\0casts\";a:2:{s:10:\"sort_order\";s:7:\"integer\";s:9:\"is_active\";s:7:\"boolean\";}s:17:\"\0*\0classCastCache\";a:0:{}s:21:\"\0*\0attributeCastCache\";a:0:{}s:13:\"\0*\0dateFormat\";N;s:10:\"\0*\0appends\";a:0:{}s:19:\"\0*\0dispatchesEvents\";a:0:{}s:14:\"\0*\0observables\";a:0:{}s:12:\"\0*\0relations\";a:0:{}s:10:\"\0*\0touches\";a:0:{}s:27:\"\0*\0relationAutoloadCallback\";N;s:26:\"\0*\0relationAutoloadContext\";N;s:10:\"timestamps\";b:1;s:13:\"usesUniqueIds\";b:0;s:9:\"\0*\0hidden\";a:0:{}s:10:\"\0*\0visible\";a:0:{}s:11:\"\0*\0fillable\";a:6:{i:0;s:4:\"code\";i:1;s:4:\"name\";i:2;s:11:\"description\";i:3;s:11:\"badge_color\";i:4;s:10:\"sort_order\";i:5;s:9:\"is_active\";}s:10:\"\0*\0guarded\";a:1:{i:0;s:1:\"*\";}}', 1774367128),
('laravel-cache-lookup:programs', 'O:39:\"Illuminate\\Database\\Eloquent\\Collection\":2:{s:8:\"\0*\0items\";a:9:{i:0;O:18:\"App\\Models\\Program\":33:{s:13:\"\0*\0connection\";s:5:\"mysql\";s:8:\"\0*\0table\";s:8:\"programs\";s:13:\"\0*\0primaryKey\";s:2:\"id\";s:10:\"\0*\0keyType\";s:3:\"int\";s:12:\"incrementing\";b:1;s:7:\"\0*\0with\";a:0:{}s:12:\"\0*\0withCount\";a:0:{}s:19:\"preventsLazyLoading\";b:0;s:10:\"\0*\0perPage\";i:15;s:6:\"exists\";b:1;s:18:\"wasRecentlyCreated\";b:0;s:28:\"\0*\0escapeWhenCastingToString\";b:0;s:13:\"\0*\0attributes\";a:9:{s:2:\"id\";s:36:\"770e9ade-3cf8-4e1b-9a45-1852c7292a0c\";s:9:\"parent_id\";N;s:4:\"code\";s:7:\"STUFAPS\";s:4:\"name\";s:37:\"Student Financial Assistance Programs\";s:11:\"description\";N;s:6:\"status\";s:6:\"active\";s:10:\"created_at\";s:19:\"2026-03-23 16:30:48\";s:10:\"updated_at\";s:19:\"2026-03-23 16:30:48\";s:14:\"children_count\";i:6;}s:11:\"\0*\0original\";a:9:{s:2:\"id\";s:36:\"770e9ade-3cf8-4e1b-9a45-1852c7292a0c\";s:9:\"parent_id\";N;s:4:\"code\";s:7:\"STUFAPS\";s:4:\"name\";s:37:\"Student Financial Assistance Programs\";s:11:\"description\";N;s:6:\"status\";s:6:\"active\";s:10:\"created_at\";s:19:\"2026-03-23 16:30:48\";s:10:\"updated_at\";s:19:\"2026-03-23 16:30:48\";s:14:\"children_count\";i:6;}s:10:\"\0*\0changes\";a:0:{}s:11:\"\0*\0previous\";a:0:{}s:8:\"\0*\0casts\";a:0:{}s:17:\"\0*\0classCastCache\";a:0:{}s:21:\"\0*\0attributeCastCache\";a:0:{}s:13:\"\0*\0dateFormat\";N;s:10:\"\0*\0appends\";a:0:{}s:19:\"\0*\0dispatchesEvents\";a:0:{}s:14:\"\0*\0observables\";a:0:{}s:12:\"\0*\0relations\";a:1:{s:6:\"parent\";N;}s:10:\"\0*\0touches\";a:0:{}s:27:\"\0*\0relationAutoloadCallback\";N;s:26:\"\0*\0relationAutoloadContext\";N;s:10:\"timestamps\";b:1;s:13:\"usesUniqueIds\";b:0;s:9:\"\0*\0hidden\";a:0:{}s:10:\"\0*\0visible\";a:0:{}s:11:\"\0*\0fillable\";a:5:{i:0;s:9:\"parent_id\";i:1;s:4:\"code\";i:2;s:4:\"name\";i:3;s:11:\"description\";i:4;s:6:\"status\";}s:10:\"\0*\0guarded\";a:1:{i:0;s:1:\"*\";}}i:1;O:18:\"App\\Models\\Program\":33:{s:13:\"\0*\0connection\";s:5:\"mysql\";s:8:\"\0*\0table\";s:8:\"programs\";s:13:\"\0*\0primaryKey\";s:2:\"id\";s:10:\"\0*\0keyType\";s:3:\"int\";s:12:\"incrementing\";b:1;s:7:\"\0*\0with\";a:0:{}s:12:\"\0*\0withCount\";a:0:{}s:19:\"preventsLazyLoading\";b:0;s:10:\"\0*\0perPage\";i:15;s:6:\"exists\";b:1;s:18:\"wasRecentlyCreated\";b:0;s:28:\"\0*\0escapeWhenCastingToString\";b:0;s:13:\"\0*\0attributes\";a:9:{s:2:\"id\";s:36:\"df19c886-3e3b-44c9-89ae-d682ec2982d2\";s:9:\"parent_id\";s:36:\"770e9ade-3cf8-4e1b-9a45-1852c7292a0c\";s:4:\"code\";s:11:\"ACEF-GIAHEP\";s:4:\"name\";s:11:\"ACEF-GIAHEP\";s:11:\"description\";s:88:\"Agricultural Competitiveness Enhancement Fund-Grants-in-Aid for Higher Education Program\";s:6:\"status\";s:6:\"active\";s:10:\"created_at\";s:19:\"2026-03-24 02:22:35\";s:10:\"updated_at\";s:19:\"2026-03-24 02:22:35\";s:14:\"children_count\";i:0;}s:11:\"\0*\0original\";a:9:{s:2:\"id\";s:36:\"df19c886-3e3b-44c9-89ae-d682ec2982d2\";s:9:\"parent_id\";s:36:\"770e9ade-3cf8-4e1b-9a45-1852c7292a0c\";s:4:\"code\";s:11:\"ACEF-GIAHEP\";s:4:\"name\";s:11:\"ACEF-GIAHEP\";s:11:\"description\";s:88:\"Agricultural Competitiveness Enhancement Fund-Grants-in-Aid for Higher Education Program\";s:6:\"status\";s:6:\"active\";s:10:\"created_at\";s:19:\"2026-03-24 02:22:35\";s:10:\"updated_at\";s:19:\"2026-03-24 02:22:35\";s:14:\"children_count\";i:0;}s:10:\"\0*\0changes\";a:0:{}s:11:\"\0*\0previous\";a:0:{}s:8:\"\0*\0casts\";a:0:{}s:17:\"\0*\0classCastCache\";a:0:{}s:21:\"\0*\0attributeCastCache\";a:0:{}s:13:\"\0*\0dateFormat\";N;s:10:\"\0*\0appends\";a:0:{}s:19:\"\0*\0dispatchesEvents\";a:0:{}s:14:\"\0*\0observables\";a:0:{}s:12:\"\0*\0relations\";a:1:{s:6:\"parent\";O:18:\"App\\Models\\Program\":33:{s:13:\"\0*\0connection\";s:5:\"mysql\";s:8:\"\0*\0table\";s:8:\"programs\";s:13:\"\0*\0primaryKey\";s:2:\"id\";s:10:\"\0*\0keyType\";s:3:\"int\";s:12:\"incrementing\";b:1;s:7:\"\0*\0with\";a:0:{}s:12:\"\0*\0withCount\";a:0:{}s:19:\"preventsLazyLoading\";b:0;s:10:\"\0*\0perPage\";i:15;s:6:\"exists\";b:1;s:18:\"wasRecentlyCreated\";b:0;s:28:\"\0*\0escapeWhenCastingToString\";b:0;s:13:\"\0*\0attributes\";a:3:{s:2:\"id\";s:36:\"770e9ade-3cf8-4e1b-9a45-1852c7292a0c\";s:4:\"code\";s:7:\"STUFAPS\";s:4:\"name\";s:37:\"Student Financial Assistance Programs\";}s:11:\"\0*\0original\";a:3:{s:2:\"id\";s:36:\"770e9ade-3cf8-4e1b-9a45-1852c7292a0c\";s:4:\"code\";s:7:\"STUFAPS\";s:4:\"name\";s:37:\"Student Financial Assistance Programs\";}s:10:\"\0*\0changes\";a:0:{}s:11:\"\0*\0previous\";a:0:{}s:8:\"\0*\0casts\";a:0:{}s:17:\"\0*\0classCastCache\";a:0:{}s:21:\"\0*\0attributeCastCache\";a:0:{}s:13:\"\0*\0dateFormat\";N;s:10:\"\0*\0appends\";a:0:{}s:19:\"\0*\0dispatchesEvents\";a:0:{}s:14:\"\0*\0observables\";a:0:{}s:12:\"\0*\0relations\";a:0:{}s:10:\"\0*\0touches\";a:0:{}s:27:\"\0*\0relationAutoloadCallback\";N;s:26:\"\0*\0relationAutoloadContext\";N;s:10:\"timestamps\";b:1;s:13:\"usesUniqueIds\";b:0;s:9:\"\0*\0hidden\";a:0:{}s:10:\"\0*\0visible\";a:0:{}s:11:\"\0*\0fillable\";a:5:{i:0;s:9:\"parent_id\";i:1;s:4:\"code\";i:2;s:4:\"name\";i:3;s:11:\"description\";i:4;s:6:\"status\";}s:10:\"\0*\0guarded\";a:1:{i:0;s:1:\"*\";}}}s:10:\"\0*\0touches\";a:0:{}s:27:\"\0*\0relationAutoloadCallback\";N;s:26:\"\0*\0relationAutoloadContext\";N;s:10:\"timestamps\";b:1;s:13:\"usesUniqueIds\";b:0;s:9:\"\0*\0hidden\";a:0:{}s:10:\"\0*\0visible\";a:0:{}s:11:\"\0*\0fillable\";a:5:{i:0;s:9:\"parent_id\";i:1;s:4:\"code\";i:2;s:4:\"name\";i:3;s:11:\"description\";i:4;s:6:\"status\";}s:10:\"\0*\0guarded\";a:1:{i:0;s:1:\"*\";}}i:2;O:18:\"App\\Models\\Program\":33:{s:13:\"\0*\0connection\";s:5:\"mysql\";s:8:\"\0*\0table\";s:8:\"programs\";s:13:\"\0*\0primaryKey\";s:2:\"id\";s:10:\"\0*\0keyType\";s:3:\"int\";s:12:\"incrementing\";b:1;s:7:\"\0*\0with\";a:0:{}s:12:\"\0*\0withCount\";a:0:{}s:19:\"preventsLazyLoading\";b:0;s:10:\"\0*\0perPage\";i:15;s:6:\"exists\";b:1;s:18:\"wasRecentlyCreated\";b:0;s:28:\"\0*\0escapeWhenCastingToString\";b:0;s:13:\"\0*\0attributes\";a:9:{s:2:\"id\";s:36:\"d167bed7-fd80-4936-b014-6210584205ba\";s:9:\"parent_id\";s:36:\"770e9ade-3cf8-4e1b-9a45-1852c7292a0c\";s:4:\"code\";s:8:\"CHED-TDP\";s:4:\"name\";s:8:\"CHED TDP\";s:11:\"description\";s:26:\"CHED Tulong Dunong Program\";s:6:\"status\";s:6:\"active\";s:10:\"created_at\";s:19:\"2026-03-24 02:18:52\";s:10:\"updated_at\";s:19:\"2026-03-24 02:18:52\";s:14:\"children_count\";i:0;}s:11:\"\0*\0original\";a:9:{s:2:\"id\";s:36:\"d167bed7-fd80-4936-b014-6210584205ba\";s:9:\"parent_id\";s:36:\"770e9ade-3cf8-4e1b-9a45-1852c7292a0c\";s:4:\"code\";s:8:\"CHED-TDP\";s:4:\"name\";s:8:\"CHED TDP\";s:11:\"description\";s:26:\"CHED Tulong Dunong Program\";s:6:\"status\";s:6:\"active\";s:10:\"created_at\";s:19:\"2026-03-24 02:18:52\";s:10:\"updated_at\";s:19:\"2026-03-24 02:18:52\";s:14:\"children_count\";i:0;}s:10:\"\0*\0changes\";a:0:{}s:11:\"\0*\0previous\";a:0:{}s:8:\"\0*\0casts\";a:0:{}s:17:\"\0*\0classCastCache\";a:0:{}s:21:\"\0*\0attributeCastCache\";a:0:{}s:13:\"\0*\0dateFormat\";N;s:10:\"\0*\0appends\";a:0:{}s:19:\"\0*\0dispatchesEvents\";a:0:{}s:14:\"\0*\0observables\";a:0:{}s:12:\"\0*\0relations\";a:1:{s:6:\"parent\";r:105;}s:10:\"\0*\0touches\";a:0:{}s:27:\"\0*\0relationAutoloadCallback\";N;s:26:\"\0*\0relationAutoloadContext\";N;s:10:\"timestamps\";b:1;s:13:\"usesUniqueIds\";b:0;s:9:\"\0*\0hidden\";a:0:{}s:10:\"\0*\0visible\";a:0:{}s:11:\"\0*\0fillable\";a:5:{i:0;s:9:\"parent_id\";i:1;s:4:\"code\";i:2;s:4:\"name\";i:3;s:11:\"description\";i:4;s:6:\"status\";}s:10:\"\0*\0guarded\";a:1:{i:0;s:1:\"*\";}}i:3;O:18:\"App\\Models\\Program\":33:{s:13:\"\0*\0connection\";s:5:\"mysql\";s:8:\"\0*\0table\";s:8:\"programs\";s:13:\"\0*\0primaryKey\";s:2:\"id\";s:10:\"\0*\0keyType\";s:3:\"int\";s:12:\"incrementing\";b:1;s:7:\"\0*\0with\";a:0:{}s:12:\"\0*\0withCount\";a:0:{}s:19:\"preventsLazyLoading\";b:0;s:10:\"\0*\0perPage\";i:15;s:6:\"exists\";b:1;s:18:\"wasRecentlyCreated\";b:0;s:28:\"\0*\0escapeWhenCastingToString\";b:0;s:13:\"\0*\0attributes\";a:9:{s:2:\"id\";s:36:\"53c5c334-0a20-4f3e-a1e2-3ec0cd178540\";s:9:\"parent_id\";s:36:\"770e9ade-3cf8-4e1b-9a45-1852c7292a0c\";s:4:\"code\";s:4:\"CMSP\";s:4:\"name\";s:4:\"CMSP\";s:11:\"description\";s:30:\"CHED Merit Scholarship Program\";s:6:\"status\";s:6:\"active\";s:10:\"created_at\";s:19:\"2026-03-24 01:56:59\";s:10:\"updated_at\";s:19:\"2026-03-24 02:19:08\";s:14:\"children_count\";i:0;}s:11:\"\0*\0original\";a:9:{s:2:\"id\";s:36:\"53c5c334-0a20-4f3e-a1e2-3ec0cd178540\";s:9:\"parent_id\";s:36:\"770e9ade-3cf8-4e1b-9a45-1852c7292a0c\";s:4:\"code\";s:4:\"CMSP\";s:4:\"name\";s:4:\"CMSP\";s:11:\"description\";s:30:\"CHED Merit Scholarship Program\";s:6:\"status\";s:6:\"active\";s:10:\"created_at\";s:19:\"2026-03-24 01:56:59\";s:10:\"updated_at\";s:19:\"2026-03-24 02:19:08\";s:14:\"children_count\";i:0;}s:10:\"\0*\0changes\";a:0:{}s:11:\"\0*\0previous\";a:0:{}s:8:\"\0*\0casts\";a:0:{}s:17:\"\0*\0classCastCache\";a:0:{}s:21:\"\0*\0attributeCastCache\";a:0:{}s:13:\"\0*\0dateFormat\";N;s:10:\"\0*\0appends\";a:0:{}s:19:\"\0*\0dispatchesEvents\";a:0:{}s:14:\"\0*\0observables\";a:0:{}s:12:\"\0*\0relations\";a:1:{s:6:\"parent\";r:105;}s:10:\"\0*\0touches\";a:0:{}s:27:\"\0*\0relationAutoloadCallback\";N;s:26:\"\0*\0relationAutoloadContext\";N;s:10:\"timestamps\";b:1;s:13:\"usesUniqueIds\";b:0;s:9:\"\0*\0hidden\";a:0:{}s:10:\"\0*\0visible\";a:0:{}s:11:\"\0*\0fillable\";a:5:{i:0;s:9:\"parent_id\";i:1;s:4:\"code\";i:2;s:4:\"name\";i:3;s:11:\"description\";i:4;s:6:\"status\";}s:10:\"\0*\0guarded\";a:1:{i:0;s:1:\"*\";}}i:4;O:18:\"App\\Models\\Program\":33:{s:13:\"\0*\0connection\";s:5:\"mysql\";s:8:\"\0*\0table\";s:8:\"programs\";s:13:\"\0*\0primaryKey\";s:2:\"id\";s:10:\"\0*\0keyType\";s:3:\"int\";s:12:\"incrementing\";b:1;s:7:\"\0*\0with\";a:0:{}s:12:\"\0*\0withCount\";a:0:{}s:19:\"preventsLazyLoading\";b:0;s:10:\"\0*\0perPage\";i:15;s:6:\"exists\";b:1;s:18:\"wasRecentlyCreated\";b:0;s:28:\"\0*\0escapeWhenCastingToString\";b:0;s:13:\"\0*\0attributes\";a:9:{s:2:\"id\";s:36:\"c600e60e-9d72-48a6-9f50-710f468309fe\";s:9:\"parent_id\";s:36:\"770e9ade-3cf8-4e1b-9a45-1852c7292a0c\";s:4:\"code\";s:6:\"COSCHO\";s:4:\"name\";s:6:\"CoScho\";s:11:\"description\";s:58:\"Scholarship Program for Coconut Farmers and their Families\";s:6:\"status\";s:6:\"active\";s:10:\"created_at\";s:19:\"2026-03-23 16:32:35\";s:10:\"updated_at\";s:19:\"2026-03-23 16:32:35\";s:14:\"children_count\";i:0;}s:11:\"\0*\0original\";a:9:{s:2:\"id\";s:36:\"c600e60e-9d72-48a6-9f50-710f468309fe\";s:9:\"parent_id\";s:36:\"770e9ade-3cf8-4e1b-9a45-1852c7292a0c\";s:4:\"code\";s:6:\"COSCHO\";s:4:\"name\";s:6:\"CoScho\";s:11:\"description\";s:58:\"Scholarship Program for Coconut Farmers and their Families\";s:6:\"status\";s:6:\"active\";s:10:\"created_at\";s:19:\"2026-03-23 16:32:35\";s:10:\"updated_at\";s:19:\"2026-03-23 16:32:35\";s:14:\"children_count\";i:0;}s:10:\"\0*\0changes\";a:0:{}s:11:\"\0*\0previous\";a:0:{}s:8:\"\0*\0casts\";a:0:{}s:17:\"\0*\0classCastCache\";a:0:{}s:21:\"\0*\0attributeCastCache\";a:0:{}s:13:\"\0*\0dateFormat\";N;s:10:\"\0*\0appends\";a:0:{}s:19:\"\0*\0dispatchesEvents\";a:0:{}s:14:\"\0*\0observables\";a:0:{}s:12:\"\0*\0relations\";a:1:{s:6:\"parent\";r:105;}s:10:\"\0*\0touches\";a:0:{}s:27:\"\0*\0relationAutoloadCallback\";N;s:26:\"\0*\0relationAutoloadContext\";N;s:10:\"timestamps\";b:1;s:13:\"usesUniqueIds\";b:0;s:9:\"\0*\0hidden\";a:0:{}s:10:\"\0*\0visible\";a:0:{}s:11:\"\0*\0fillable\";a:5:{i:0;s:9:\"parent_id\";i:1;s:4:\"code\";i:2;s:4:\"name\";i:3;s:11:\"description\";i:4;s:6:\"status\";}s:10:\"\0*\0guarded\";a:1:{i:0;s:1:\"*\";}}i:5;O:18:\"App\\Models\\Program\":33:{s:13:\"\0*\0connection\";s:5:\"mysql\";s:8:\"\0*\0table\";s:8:\"programs\";s:13:\"\0*\0primaryKey\";s:2:\"id\";s:10:\"\0*\0keyType\";s:3:\"int\";s:12:\"incrementing\";b:1;s:7:\"\0*\0with\";a:0:{}s:12:\"\0*\0withCount\";a:0:{}s:19:\"preventsLazyLoading\";b:0;s:10:\"\0*\0perPage\";i:15;s:6:\"exists\";b:1;s:18:\"wasRecentlyCreated\";b:0;s:28:\"\0*\0escapeWhenCastingToString\";b:0;s:13:\"\0*\0attributes\";a:9:{s:2:\"id\";s:36:\"49f6eb41-cd42-4359-b2b2-f0895af7c383\";s:9:\"parent_id\";s:36:\"770e9ade-3cf8-4e1b-9a45-1852c7292a0c\";s:4:\"code\";s:4:\"MSRS\";s:4:\"name\";s:4:\"MSRS\";s:11:\"description\";s:38:\"Medical Scholarship and Return Service\";s:6:\"status\";s:6:\"active\";s:10:\"created_at\";s:19:\"2026-03-24 02:32:32\";s:10:\"updated_at\";s:19:\"2026-03-24 02:32:32\";s:14:\"children_count\";i:0;}s:11:\"\0*\0original\";a:9:{s:2:\"id\";s:36:\"49f6eb41-cd42-4359-b2b2-f0895af7c383\";s:9:\"parent_id\";s:36:\"770e9ade-3cf8-4e1b-9a45-1852c7292a0c\";s:4:\"code\";s:4:\"MSRS\";s:4:\"name\";s:4:\"MSRS\";s:11:\"description\";s:38:\"Medical Scholarship and Return Service\";s:6:\"status\";s:6:\"active\";s:10:\"created_at\";s:19:\"2026-03-24 02:32:32\";s:10:\"updated_at\";s:19:\"2026-03-24 02:32:32\";s:14:\"children_count\";i:0;}s:10:\"\0*\0changes\";a:0:{}s:11:\"\0*\0previous\";a:0:{}s:8:\"\0*\0casts\";a:0:{}s:17:\"\0*\0classCastCache\";a:0:{}s:21:\"\0*\0attributeCastCache\";a:0:{}s:13:\"\0*\0dateFormat\";N;s:10:\"\0*\0appends\";a:0:{}s:19:\"\0*\0dispatchesEvents\";a:0:{}s:14:\"\0*\0observables\";a:0:{}s:12:\"\0*\0relations\";a:1:{s:6:\"parent\";r:105;}s:10:\"\0*\0touches\";a:0:{}s:27:\"\0*\0relationAutoloadCallback\";N;s:26:\"\0*\0relationAutoloadContext\";N;s:10:\"timestamps\";b:1;s:13:\"usesUniqueIds\";b:0;s:9:\"\0*\0hidden\";a:0:{}s:10:\"\0*\0visible\";a:0:{}s:11:\"\0*\0fillable\";a:5:{i:0;s:9:\"parent_id\";i:1;s:4:\"code\";i:2;s:4:\"name\";i:3;s:11:\"description\";i:4;s:6:\"status\";}s:10:\"\0*\0guarded\";a:1:{i:0;s:1:\"*\";}}i:6;O:18:\"App\\Models\\Program\":33:{s:13:\"\0*\0connection\";s:5:\"mysql\";s:8:\"\0*\0table\";s:8:\"programs\";s:13:\"\0*\0primaryKey\";s:2:\"id\";s:10:\"\0*\0keyType\";s:3:\"int\";s:12:\"incrementing\";b:1;s:7:\"\0*\0with\";a:0:{}s:12:\"\0*\0withCount\";a:0:{}s:19:\"preventsLazyLoading\";b:0;s:10:\"\0*\0perPage\";i:15;s:6:\"exists\";b:1;s:18:\"wasRecentlyCreated\";b:0;s:28:\"\0*\0escapeWhenCastingToString\";b:0;s:13:\"\0*\0attributes\";a:9:{s:2:\"id\";s:36:\"b92ec35b-6304-4e1b-a149-aa3330219fb4\";s:9:\"parent_id\";s:36:\"770e9ade-3cf8-4e1b-9a45-1852c7292a0c\";s:4:\"code\";s:8:\"SIDA-SGP\";s:4:\"name\";s:8:\"SIDA-SGP\";s:11:\"description\";s:103:\"Scholarship Grant for Children and Dependents of Sugarcane Industry Workers and Small Sugarcane Farmers\";s:6:\"status\";s:6:\"active\";s:10:\"created_at\";s:19:\"2026-03-24 02:25:40\";s:10:\"updated_at\";s:19:\"2026-03-24 02:25:46\";s:14:\"children_count\";i:0;}s:11:\"\0*\0original\";a:9:{s:2:\"id\";s:36:\"b92ec35b-6304-4e1b-a149-aa3330219fb4\";s:9:\"parent_id\";s:36:\"770e9ade-3cf8-4e1b-9a45-1852c7292a0c\";s:4:\"code\";s:8:\"SIDA-SGP\";s:4:\"name\";s:8:\"SIDA-SGP\";s:11:\"description\";s:103:\"Scholarship Grant for Children and Dependents of Sugarcane Industry Workers and Small Sugarcane Farmers\";s:6:\"status\";s:6:\"active\";s:10:\"created_at\";s:19:\"2026-03-24 02:25:40\";s:10:\"updated_at\";s:19:\"2026-03-24 02:25:46\";s:14:\"children_count\";i:0;}s:10:\"\0*\0changes\";a:0:{}s:11:\"\0*\0previous\";a:0:{}s:8:\"\0*\0casts\";a:0:{}s:17:\"\0*\0classCastCache\";a:0:{}s:21:\"\0*\0attributeCastCache\";a:0:{}s:13:\"\0*\0dateFormat\";N;s:10:\"\0*\0appends\";a:0:{}s:19:\"\0*\0dispatchesEvents\";a:0:{}s:14:\"\0*\0observables\";a:0:{}s:12:\"\0*\0relations\";a:1:{s:6:\"parent\";r:105;}s:10:\"\0*\0touches\";a:0:{}s:27:\"\0*\0relationAutoloadCallback\";N;s:26:\"\0*\0relationAutoloadContext\";N;s:10:\"timestamps\";b:1;s:13:\"usesUniqueIds\";b:0;s:9:\"\0*\0hidden\";a:0:{}s:10:\"\0*\0visible\";a:0:{}s:11:\"\0*\0fillable\";a:5:{i:0;s:9:\"parent_id\";i:1;s:4:\"code\";i:2;s:4:\"name\";i:3;s:11:\"description\";i:4;s:6:\"status\";}s:10:\"\0*\0guarded\";a:1:{i:0;s:1:\"*\";}}i:7;O:18:\"App\\Models\\Program\":33:{s:13:\"\0*\0connection\";s:5:\"mysql\";s:8:\"\0*\0table\";s:8:\"programs\";s:13:\"\0*\0primaryKey\";s:2:\"id\";s:10:\"\0*\0keyType\";s:3:\"int\";s:12:\"incrementing\";b:1;s:7:\"\0*\0with\";a:0:{}s:12:\"\0*\0withCount\";a:0:{}s:19:\"preventsLazyLoading\";b:0;s:10:\"\0*\0perPage\";i:15;s:6:\"exists\";b:1;s:18:\"wasRecentlyCreated\";b:0;s:28:\"\0*\0escapeWhenCastingToString\";b:0;s:13:\"\0*\0attributes\";a:9:{s:2:\"id\";s:36:\"a9c8ffd8-637d-4c50-85e4-778934730ccf\";s:9:\"parent_id\";N;s:4:\"code\";s:3:\"TES\";s:4:\"name\";s:26:\"Tertiary Education Subsidy\";s:11:\"description\";s:60:\"Financial assistance program for tertiary education students\";s:6:\"status\";s:6:\"active\";s:10:\"created_at\";s:19:\"2026-03-23 10:17:44\";s:10:\"updated_at\";s:19:\"2026-03-23 10:17:44\";s:14:\"children_count\";i:0;}s:11:\"\0*\0original\";a:9:{s:2:\"id\";s:36:\"a9c8ffd8-637d-4c50-85e4-778934730ccf\";s:9:\"parent_id\";N;s:4:\"code\";s:3:\"TES\";s:4:\"name\";s:26:\"Tertiary Education Subsidy\";s:11:\"description\";s:60:\"Financial assistance program for tertiary education students\";s:6:\"status\";s:6:\"active\";s:10:\"created_at\";s:19:\"2026-03-23 10:17:44\";s:10:\"updated_at\";s:19:\"2026-03-23 10:17:44\";s:14:\"children_count\";i:0;}s:10:\"\0*\0changes\";a:0:{}s:11:\"\0*\0previous\";a:0:{}s:8:\"\0*\0casts\";a:0:{}s:17:\"\0*\0classCastCache\";a:0:{}s:21:\"\0*\0attributeCastCache\";a:0:{}s:13:\"\0*\0dateFormat\";N;s:10:\"\0*\0appends\";a:0:{}s:19:\"\0*\0dispatchesEvents\";a:0:{}s:14:\"\0*\0observables\";a:0:{}s:12:\"\0*\0relations\";a:1:{s:6:\"parent\";N;}s:10:\"\0*\0touches\";a:0:{}s:27:\"\0*\0relationAutoloadCallback\";N;s:26:\"\0*\0relationAutoloadContext\";N;s:10:\"timestamps\";b:1;s:13:\"usesUniqueIds\";b:0;s:9:\"\0*\0hidden\";a:0:{}s:10:\"\0*\0visible\";a:0:{}s:11:\"\0*\0fillable\";a:5:{i:0;s:9:\"parent_id\";i:1;s:4:\"code\";i:2;s:4:\"name\";i:3;s:11:\"description\";i:4;s:6:\"status\";}s:10:\"\0*\0guarded\";a:1:{i:0;s:1:\"*\";}}i:8;O:18:\"App\\Models\\Program\":33:{s:13:\"\0*\0connection\";s:5:\"mysql\";s:8:\"\0*\0table\";s:8:\"programs\";s:13:\"\0*\0primaryKey\";s:2:\"id\";s:10:\"\0*\0keyType\";s:3:\"int\";s:12:\"incrementing\";b:1;s:7:\"\0*\0with\";a:0:{}s:12:\"\0*\0withCount\";a:0:{}s:19:\"preventsLazyLoading\";b:0;s:10:\"\0*\0perPage\";i:15;s:6:\"exists\";b:1;s:18:\"wasRecentlyCreated\";b:0;s:28:\"\0*\0escapeWhenCastingToString\";b:0;s:13:\"\0*\0attributes\";a:9:{s:2:\"id\";s:36:\"e54348a6-5f2e-4472-9d44-1d699c50bfb4\";s:9:\"parent_id\";N;s:4:\"code\";s:3:\"TDP\";s:4:\"name\";s:21:\"Tulong Dunong Program\";s:11:\"description\";s:42:\"Scholarship program for deserving students\";s:6:\"status\";s:6:\"active\";s:10:\"created_at\";s:19:\"2026-03-23 10:17:44\";s:10:\"updated_at\";s:19:\"2026-03-23 10:17:44\";s:14:\"children_count\";i:0;}s:11:\"\0*\0original\";a:9:{s:2:\"id\";s:36:\"e54348a6-5f2e-4472-9d44-1d699c50bfb4\";s:9:\"parent_id\";N;s:4:\"code\";s:3:\"TDP\";s:4:\"name\";s:21:\"Tulong Dunong Program\";s:11:\"description\";s:42:\"Scholarship program for deserving students\";s:6:\"status\";s:6:\"active\";s:10:\"created_at\";s:19:\"2026-03-23 10:17:44\";s:10:\"updated_at\";s:19:\"2026-03-23 10:17:44\";s:14:\"children_count\";i:0;}s:10:\"\0*\0changes\";a:0:{}s:11:\"\0*\0previous\";a:0:{}s:8:\"\0*\0casts\";a:0:{}s:17:\"\0*\0classCastCache\";a:0:{}s:21:\"\0*\0attributeCastCache\";a:0:{}s:13:\"\0*\0dateFormat\";N;s:10:\"\0*\0appends\";a:0:{}s:19:\"\0*\0dispatchesEvents\";a:0:{}s:14:\"\0*\0observables\";a:0:{}s:12:\"\0*\0relations\";a:1:{s:6:\"parent\";N;}s:10:\"\0*\0touches\";a:0:{}s:27:\"\0*\0relationAutoloadCallback\";N;s:26:\"\0*\0relationAutoloadContext\";N;s:10:\"timestamps\";b:1;s:13:\"usesUniqueIds\";b:0;s:9:\"\0*\0hidden\";a:0:{}s:10:\"\0*\0visible\";a:0:{}s:11:\"\0*\0fillable\";a:5:{i:0;s:9:\"parent_id\";i:1;s:4:\"code\";i:2;s:4:\"name\";i:3;s:11:\"description\";i:4;s:6:\"status\";}s:10:\"\0*\0guarded\";a:1:{i:0;s:1:\"*\";}}}s:28:\"\0*\0escapeWhenCastingToString\";b:0;}', 1774324286),
('laravel-cache-users:accountants', 'O:39:\"Illuminate\\Database\\Eloquent\\Collection\":2:{s:8:\"\0*\0items\";a:0:{}s:28:\"\0*\0escapeWhenCastingToString\";b:0;}', 1774320986),
('laravel-cache-users:regional_coordinators', 'O:39:\"Illuminate\\Database\\Eloquent\\Collection\":2:{s:8:\"\0*\0items\";a:0:{}s:28:\"\0*\0escapeWhenCastingToString\";b:0;}', 1774320986);

-- --------------------------------------------------------

--
-- Table structure for table `cache_locks`
--

CREATE TABLE IF NOT EXISTS `cache_locks` (
  `key` varchar(255) NOT NULL,
  `owner` varchar(255) NOT NULL,
  `expiration` int(11) NOT NULL,
  PRIMARY KEY (`key`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

--
-- RELATIONSHIPS FOR TABLE `cache_locks`:
--

-- --------------------------------------------------------

--
-- Table structure for table `compliance_statuses`
--

CREATE TABLE IF NOT EXISTS `compliance_statuses` (
  `id` char(36) NOT NULL,
  `code` varchar(50) NOT NULL,
  `name` varchar(100) NOT NULL,
  `description` varchar(255) DEFAULT NULL,
  `badge_color` varchar(50) NOT NULL DEFAULT 'secondary',
  `sort_order` int(10) UNSIGNED NOT NULL DEFAULT 0,
  `is_active` tinyint(1) NOT NULL DEFAULT 1,
  `created_at` timestamp NULL DEFAULT NULL,
  `updated_at` timestamp NULL DEFAULT NULL,
  PRIMARY KEY (`id`),
  UNIQUE KEY `compliance_statuses_code_unique` (`code`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

--
-- RELATIONSHIPS FOR TABLE `compliance_statuses`:
--

--
-- Dumping data for table `compliance_statuses`
--

INSERT INTO `compliance_statuses` (`id`, `code`, `name`, `description`, `badge_color`, `sort_order`, `is_active`, `created_at`, `updated_at`) VALUES
('099d649a-cba8-4487-b29b-ed42c4e871f7', 'pending_hei_review', 'Pending HEI Review', 'Awaiting HEI to review compliance requirements', 'warning', 1, 1, '2026-03-23 02:17:40', '2026-03-23 02:17:40'),
('2992657e-6fa7-46c6-b6e5-4cba16785a03', 'non_compliant', 'Non-Compliant', 'HEI has not met compliance requirements', 'destructive', 5, 1, '2026-03-23 02:17:40', '2026-03-23 02:17:40'),
('5eedccaf-7ba6-41fa-b56b-cf307351949b', 'compliant', 'Compliant', 'HEI has met all compliance requirements', 'success', 4, 1, '2026-03-23 02:17:40', '2026-03-23 02:17:40'),
('88987a59-9d93-421c-a02b-b5ec9a34ab78', 'documents_submitted', 'Documents Submitted', 'HEI has submitted compliance documents', 'info', 2, 1, '2026-03-23 02:17:40', '2026-03-23 02:17:40'),
('a060dced-0f45-4e90-8880-2d443876e9a5', 'under_review', 'Under Review', 'Compliance documents are being reviewed', 'info', 3, 1, '2026-03-23 02:17:40', '2026-03-23 02:17:40');

-- --------------------------------------------------------

--
-- Table structure for table `document_locations`
--

CREATE TABLE IF NOT EXISTS `document_locations` (
  `id` char(36) NOT NULL,
  `name` varchar(255) NOT NULL,
  `sort_order` int(11) NOT NULL DEFAULT 0,
  `created_at` timestamp NULL DEFAULT NULL,
  `updated_at` timestamp NULL DEFAULT NULL,
  PRIMARY KEY (`id`),
  UNIQUE KEY `document_locations_name_unique` (`name`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

--
-- RELATIONSHIPS FOR TABLE `document_locations`:
--

--
-- Dumping data for table `document_locations`
--

INSERT INTO `document_locations` (`id`, `name`, `sort_order`, `created_at`, `updated_at`) VALUES
('0453de99-cb48-4bfb-af23-0177ab7a2295', 'Shelf 1-F-R1', 25, '2026-03-23 02:17:45', '2026-03-23 02:17:45'),
('05250539-03b8-420a-af69-7ced00749026', 'Shelf 1-B-R5', 9, '2026-03-23 02:17:44', '2026-03-23 02:17:44'),
('0840c9e1-c1cb-43cd-a179-49e45915068a', 'Shelf 1-H-R4', 38, '2026-03-23 02:17:45', '2026-03-23 02:17:45'),
('0ae18fc3-da0a-402b-9bb5-78acdf9ef599', 'Shelf 2-B-R5', 54, '2026-03-23 02:17:45', '2026-03-23 02:17:45'),
('0ffd1262-f1f2-4606-b21d-030bc616857f', 'Shelf 1-G-R1', 30, '2026-03-23 02:17:45', '2026-03-23 02:17:45'),
('123443c9-b0b2-4d50-a76c-8dfa204bcf1b', 'Shelf 1-I-R4', 43, '2026-03-23 02:17:45', '2026-03-23 02:17:45'),
('14ee9afd-8286-4673-9535-ba44c4cbc613', 'Shelf 1-F-R2', 26, '2026-03-23 02:17:45', '2026-03-23 02:17:45'),
('16e785fd-32a4-4496-8bef-577bbc898698', 'Shelf 2-D-R5', 64, '2026-03-23 02:17:45', '2026-03-23 02:17:45'),
('1cb3a684-00e0-42f0-b372-8d36e2650fb8', 'Shelf 1-D-R4', 18, '2026-03-23 02:17:44', '2026-03-23 02:17:44'),
('21871f56-d633-4046-a8a6-d5d5e743aa9d', 'Shelf 1-C-R3', 12, '2026-03-23 02:17:44', '2026-03-23 02:17:44'),
('21f4bb3e-b16c-4cd1-8223-05491884d8ad', 'Shelf 1-A-R1', 0, '2026-03-23 02:17:44', '2026-03-23 02:17:44'),
('230439ae-6531-415c-a571-8d04e1938004', 'Shelf 2-G-R5', 79, '2026-03-23 02:17:45', '2026-03-23 02:17:45'),
('28b1986b-a226-4bca-9a15-81ffc46f3d4b', 'In Personnel Area', 81, '2026-03-23 02:17:45', '2026-03-23 02:17:45'),
('299af07e-108b-412f-b155-8e57bec95d3b', 'Shelf 1-B-R4', 8, '2026-03-23 02:17:44', '2026-03-23 02:17:44'),
('2cbbcd2a-ab91-4d92-af0b-3c80d45d1085', 'Shelf 1-G-R2', 31, '2026-03-23 02:17:45', '2026-03-23 02:17:45'),
('2d886d40-6237-4a47-972b-5a2f611e1db2', 'Shelf 2-G-R2', 76, '2026-03-23 02:17:45', '2026-03-23 02:17:45'),
('2f0f084c-2fb3-4f09-83e2-5f95c16f22c1', 'Shelf 1-E-R5', 24, '2026-03-23 02:17:45', '2026-03-23 02:17:45'),
('2fdbb4e8-1963-4ede-9aa0-0ba6e244d1cd', 'Shelf 1-C-R4', 13, '2026-03-23 02:17:44', '2026-03-23 02:17:44'),
('31fd56f2-8556-4942-bfba-affe1c621e5e', 'Shelf 1-G-R3', 32, '2026-03-23 02:17:45', '2026-03-23 02:17:45'),
('33ea80bf-3998-47ec-883e-e76a4aa8f98b', 'Shelf 1-E-R4', 23, '2026-03-23 02:17:45', '2026-03-23 02:17:45'),
('34da278c-5647-44df-af40-3d09cdc93825', 'Shelf 2-A-R1', 45, '2026-03-23 02:17:45', '2026-03-23 02:17:45'),
('373f748f-5d81-43bc-bd40-6a7f88154de8', 'Shelf 2-C-R4', 58, '2026-03-23 02:17:45', '2026-03-23 02:17:45'),
('378e4973-6403-420b-bc6a-66f842429f1c', 'Shelf 1-C-R1', 10, '2026-03-23 02:17:44', '2026-03-23 02:17:44'),
('37d92af9-19b0-435e-9370-efdeed653322', 'Shelf 1-G-R5', 34, '2026-03-23 02:17:45', '2026-03-23 02:17:45'),
('3c8d0fc4-eac4-47dc-bde9-b86bc5ee6c1b', 'Shelf 2-D-R3', 62, '2026-03-23 02:17:45', '2026-03-23 02:17:45'),
('3d3e2085-d32a-4c10-9e64-b6528e89828c', 'Shelf 2-G-R1', 75, '2026-03-23 02:17:45', '2026-03-23 02:17:45'),
('3d48e88c-a8c2-4bbe-842e-b85afe9d6274', 'Shelf 1-I-R2', 41, '2026-03-23 02:17:45', '2026-03-23 02:17:45'),
('3e72f552-4c60-486d-b3db-bbf563910e8c', 'Shelf 1-B-R1', 5, '2026-03-23 02:17:44', '2026-03-23 02:17:44'),
('4215d6d5-91b1-4569-86eb-f52f5c266987', 'Shelf 2-F-R1', 70, '2026-03-23 02:17:45', '2026-03-23 02:17:45'),
('4433c0eb-c74c-466b-a7ee-786c69ad469a', 'Shelf 2-E-R5', 69, '2026-03-23 02:17:45', '2026-03-23 02:17:45'),
('4498daaf-e9c7-4b7e-ace8-b413e1265d40', 'Shelf 2-B-R4', 53, '2026-03-23 02:17:45', '2026-03-23 02:17:45'),
('4a452e79-ecf3-4092-bbc8-56956c80dfc3', 'Shelf 1-A-R2', 1, '2026-03-23 02:17:44', '2026-03-23 02:17:44'),
('4fc3fea6-f3fe-4707-9911-f646fc6422e6', 'Shelf 2-B-R2', 51, '2026-03-23 02:17:45', '2026-03-23 02:17:45'),
('5395f49c-9251-4f4a-b248-08b3bd587fc3', 'Shelf 2-A-R2', 46, '2026-03-23 02:17:45', '2026-03-23 02:17:45'),
('5b49251b-41f5-4fcd-a863-9f7707024a42', 'Shelf 2-E-R3', 67, '2026-03-23 02:17:45', '2026-03-23 02:17:45'),
('5e5e0358-c1c1-4320-9aa4-cdc04499ac88', 'Shelf 2-G-R4', 78, '2026-03-23 02:17:45', '2026-03-23 02:17:45'),
('5ee597ea-209d-4cfb-932c-62d2947587f9', 'Shelf 2-D-R1', 60, '2026-03-23 02:17:45', '2026-03-23 02:17:45'),
('5f66505e-1197-4bde-b20e-f933248e8815', 'Shelf 2-E-R1', 65, '2026-03-23 02:17:45', '2026-03-23 02:17:45'),
('64160366-c142-4ec9-b662-9b9eef1709b1', 'Shelf 1-B-R3', 7, '2026-03-23 02:17:44', '2026-03-23 02:17:44'),
('6b63afd3-0e5e-476f-8162-f58b96aa5f8f', 'Shelf 1-E-R1', 20, '2026-03-23 02:17:45', '2026-03-23 02:17:45'),
('6c9826c3-2657-4b90-8ec2-9179df11084d', 'Shelf 1-H-R5', 39, '2026-03-23 02:17:45', '2026-03-23 02:17:45'),
('6e87ff28-81a5-4dc4-b9df-c5a76b393626', 'Shelf 2-E-R2', 66, '2026-03-23 02:17:45', '2026-03-23 02:17:45'),
('70ef335a-e58d-40c9-868f-2d13779058fe', 'Outside Office - Storage Box', 80, '2026-03-23 02:17:45', '2026-03-23 02:17:45'),
('73c2fd68-4993-4f98-aaad-404476f2ab07', 'Shelf 2-F-R5', 74, '2026-03-23 02:17:45', '2026-03-23 02:17:45'),
('7587ea1f-01fb-4f57-b987-5be05dccc747', 'Shelf 2-A-R3', 47, '2026-03-23 02:17:45', '2026-03-23 02:17:45'),
('7f9646a3-efa9-4cb0-99a2-77a5c2b9aeb6', 'Shelf 1-I-R3', 42, '2026-03-23 02:17:45', '2026-03-23 02:17:45'),
('840b0044-f4e4-460d-befa-1170347afe99', 'Shelf 2-A-R5', 49, '2026-03-23 02:17:45', '2026-03-23 02:17:45'),
('893ae91f-c3ac-40f2-98d4-505f6778b62b', 'Shelf 1-E-R2', 21, '2026-03-23 02:17:45', '2026-03-23 02:17:45'),
('93dba473-5492-4cfd-bf92-306d1bd57f6e', 'Shelf 2-C-R1', 55, '2026-03-23 02:17:45', '2026-03-23 02:17:45'),
('94a670a3-0d0c-4a96-a72b-36303314b808', 'Shelf 2-D-R2', 61, '2026-03-23 02:17:45', '2026-03-23 02:17:45'),
('953c59f7-a971-448d-8a62-8b8b659da49b', 'Shelf 2-A-R4', 48, '2026-03-23 02:17:45', '2026-03-23 02:17:45'),
('9735debf-3d7e-4816-acb4-3651d654b483', 'Shelf 1-D-R3', 17, '2026-03-23 02:17:44', '2026-03-23 02:17:44'),
('97596fd5-8bf0-48f1-a9b9-04e592a3b284', 'Shelf 2-F-R3', 72, '2026-03-23 02:17:45', '2026-03-23 02:17:45'),
('9937612a-dffb-4db1-b532-e97b6bbee3cd', 'Shelf 1-A-R4', 3, '2026-03-23 02:17:44', '2026-03-23 02:17:44'),
('9c3b6448-6b8b-4084-8efb-3987464716f8', 'Shelf 2-B-R1', 50, '2026-03-23 02:17:45', '2026-03-23 02:17:45'),
('9f15b53c-dd81-4529-aa76-88160a0be1ac', 'Shelf 1-I-R5', 44, '2026-03-23 02:17:45', '2026-03-23 02:17:45'),
('a04c5a96-25aa-4df6-be14-af77249d4b26', 'Shelf 1-C-R2', 11, '2026-03-23 02:17:44', '2026-03-23 02:17:44'),
('a0e02376-202e-439f-8d22-53d97e9dd15f', 'Shelf 2-E-R4', 68, '2026-03-23 02:17:45', '2026-03-23 02:17:45'),
('a8e1622f-b589-4ab8-933c-12d19bab89bd', 'Shelf 1-I-R1', 40, '2026-03-23 02:17:45', '2026-03-23 02:17:45'),
('aafaf23d-e11b-45f6-a30b-93700d011ea5', 'Shelf 1-F-R4', 28, '2026-03-23 02:17:45', '2026-03-23 02:17:45'),
('ac6f62f1-4b08-4ac2-809c-654bfe81fecc', 'Shelf 2-D-R4', 63, '2026-03-23 02:17:45', '2026-03-23 02:17:45'),
('b8381a2d-0ffd-4f2b-b46e-8f9e8606df1c', 'Shelf 1-F-R5', 29, '2026-03-23 02:17:45', '2026-03-23 02:17:45'),
('b8f39861-f2d2-4ec1-bc89-dc872cb8b4bb', 'Shelf 2-C-R5', 59, '2026-03-23 02:17:45', '2026-03-23 02:17:45'),
('b9f4af4e-da8c-44f7-b515-eff5ad719c19', 'Shelf 1-D-R2', 16, '2026-03-23 02:17:44', '2026-03-23 02:17:44'),
('c23f07c0-f577-4468-9aba-a88d88b40271', 'Shelf 1-D-R1', 15, '2026-03-23 02:17:44', '2026-03-23 02:17:44'),
('c289a408-6dc8-4613-9d07-936f6e6d9ffc', 'Shelf 1-F-R3', 27, '2026-03-23 02:17:45', '2026-03-23 02:17:45'),
('c43c83d0-32b9-4796-a0f7-a47d64160b53', 'Shelf 1-H-R3', 37, '2026-03-23 02:17:45', '2026-03-23 02:17:45'),
('c730f917-f8e2-4ded-a5e6-c244d329d53c', 'Shelf 2-C-R3', 57, '2026-03-23 02:17:45', '2026-03-23 02:17:45'),
('cceb8b31-4a46-4d34-9c01-6340634dd919', 'Shelf 1-C-R5', 14, '2026-03-23 02:17:44', '2026-03-23 02:17:44'),
('cfa8cb9c-5221-4b09-b2be-a6e8f2f4b655', 'Shelf 2-B-R3', 52, '2026-03-23 02:17:45', '2026-03-23 02:17:45'),
('cfe0f6b1-b735-410a-80f0-3023adc22130', 'Shelf 2-F-R2', 71, '2026-03-23 02:17:45', '2026-03-23 02:17:45'),
('d010944e-f6bf-4df5-80eb-68df34fb33cb', 'Shelf 1-B-R2', 6, '2026-03-23 02:17:44', '2026-03-23 02:17:44'),
('dcfe3ec0-1bb2-4df7-ba78-31641c167af7', 'Shelf 2-F-R4', 73, '2026-03-23 02:17:45', '2026-03-23 02:17:45'),
('e076d730-6934-4cbe-b228-aa12d4ba0070', 'Shelf 1-A-R3', 2, '2026-03-23 02:17:44', '2026-03-23 02:17:44'),
('e5bb8a0f-4e6d-4ce8-a4eb-e78bf6b9ceca', 'Shelf 1-H-R1', 35, '2026-03-23 02:17:45', '2026-03-23 02:17:45'),
('e8e367cc-d3bb-456e-ad44-033bf112ad8b', 'Shelf 1-G-R4', 33, '2026-03-23 02:17:45', '2026-03-23 02:17:45'),
('e9f32e51-07de-45e2-a381-159f4010d34b', 'Shelf 2-C-R2', 56, '2026-03-23 02:17:45', '2026-03-23 02:17:45'),
('eb144999-507a-42e1-b7d4-616fe4bd1d00', 'Shelf 1-A-R5', 4, '2026-03-23 02:17:44', '2026-03-23 02:17:44'),
('ebfb56bc-712f-4c08-b937-e1cc3e25c7ee', 'Shelf 1-H-R2', 36, '2026-03-23 02:17:45', '2026-03-23 02:17:45'),
('eef03b8a-68a3-4b58-82e2-a9aab0fc899d', 'Shelf 1-E-R3', 22, '2026-03-23 02:17:45', '2026-03-23 02:17:45'),
('f5abbf52-2450-4df2-aa60-a382b8de6e90', 'Shelf 1-D-R5', 19, '2026-03-23 02:17:44', '2026-03-23 02:17:44'),
('fdc7017b-9ed1-4073-97bd-10213a611b90', 'Shelf 2-G-R3', 77, '2026-03-23 02:17:45', '2026-03-23 02:17:45');

-- --------------------------------------------------------

--
-- Table structure for table `document_requirements`
--

CREATE TABLE IF NOT EXISTS `document_requirements` (
  `id` char(36) NOT NULL,
  `program_id` char(36) NOT NULL,
  `code` varchar(50) NOT NULL,
  `name` varchar(255) NOT NULL,
  `description` text DEFAULT NULL,
  `reference_image_path` varchar(255) DEFAULT NULL,
  `upload_message` text DEFAULT NULL,
  `sort_order` int(11) NOT NULL DEFAULT 0,
  `is_active` tinyint(1) NOT NULL DEFAULT 1,
  `is_required` tinyint(1) NOT NULL DEFAULT 1,
  `created_at` timestamp NULL DEFAULT NULL,
  `updated_at` timestamp NULL DEFAULT NULL,
  PRIMARY KEY (`id`),
  UNIQUE KEY `document_requirements_program_id_code_unique` (`program_id`,`code`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

--
-- RELATIONSHIPS FOR TABLE `document_requirements`:
--   `program_id`
--       `programs` -> `id`
--

--
-- Dumping data for table `document_requirements`
--

INSERT INTO `document_requirements` (`id`, `program_id`, `code`, `name`, `description`, `reference_image_path`, `upload_message`, `sort_order`, `is_active`, `is_required`, `created_at`, `updated_at`) VALUES
('0585ec54-74c2-4a3f-94e3-2c54a20e1ed5', 'c600e60e-9d72-48a6-9f50-710f468309fe', 'FSR', 'Financial Status Report', 'Original copy of the Financial Status Report duly certified correct by the Accountant, approved by the HEI President and received by the Commission on Audit (COA)', NULL, 'The signature/s in the Financial Status Report should be fresh not e - signature', 0, 1, 1, '2026-03-23 17:49:02', '2026-03-23 17:49:02'),
('0b6189d2-937c-4819-a8ea-2b528e711489', 'c600e60e-9d72-48a6-9f50-710f468309fe', 'OR', 'Official Receipt of the utilized/returned ASC', 'Original/Certified True Copy of the Official Receipt of the utilized/returned Administrative Cost', NULL, NULL, 0, 1, 1, '2026-03-23 17:54:43', '2026-03-23 17:54:43'),
('0f66c9bd-3044-4f6a-9222-f16e1b5f350f', 'c600e60e-9d72-48a6-9f50-710f468309fe', 'GP', 'General Payroll (Billing)', 'Original or certified true copy of the General Payroll (Billing) signed by scholars duly certified correct by the accountant, approved by the HEI President and Received COA for SUCs / verified by the internal auditor for Private HEIs', NULL, 'Please make sure that all grantees have signed in the billing.', 0, 1, 1, '2026-03-23 17:49:45', '2026-03-23 17:49:45'),
('1dabc9ff-051e-4b82-a24d-d3272dd369b4', 'a9c8ffd8-637d-4c50-85e4-778934730ccf', 'TRANSMITTAL', 'Transmittal', 'Should be duly signed by the president or head of HEI', NULL, 'The attached transmittal letter must be duly signed by the President/Head of your HEI. Proceed with upload?', 1, 1, 1, '2026-03-23 02:17:45', '2026-03-23 07:48:04'),
('23c1166c-188a-41b1-9a08-7ee366ab96b3', 'c600e60e-9d72-48a6-9f50-710f468309fe', 'VIC', 'Valid Identification Card', 'Certified true copy of valid Identification (ID) Card bearing scholars\' signature', NULL, 'Must bear 3 specimen signature of grantee/s', 0, 1, 1, '2026-03-23 17:54:02', '2026-03-23 17:54:02'),
('282f90cd-7af5-421b-91df-78bda9658c6c', 'a9c8ffd8-637d-4c50-85e4-778934730ccf', 'BILLING_DOCS', 'Billing Documents', 'Attach the updated Billing documents received from CHED\'s Cashier\'s Office', NULL, 'The attached updated billing documents must be received from CHED\'s Cashier\'s Office. Proceed with upload?', 6, 1, 1, '2026-03-23 02:17:45', '2026-03-23 07:54:41'),
('337fba6a-a69c-4c5b-bbfd-a5b557a1c637', 'c600e60e-9d72-48a6-9f50-710f468309fe', 'COG', 'Certificate of Grades', 'Original or certified true copy of certificate of grades', NULL, 'Please upload complete and approriate document', 0, 1, 1, '2026-03-23 17:53:16', '2026-03-23 17:53:16'),
('360a3e45-0b60-4b0f-ab72-07dd2112c00d', 'b92ec35b-6304-4e1b-a149-aa3330219fb4', 'COE-COR', 'Certificate of Enrollment (COE) or Certificate of Registration (COR)', 'Original/Certified True Copy of Certificate of Enrollment (COE) or Certificate of Registration (COR)', NULL, 'Please upload complete documents.', 0, 1, 1, '2026-03-23 18:28:54', '2026-03-23 18:28:54'),
('3c4a4ee7-55b1-4655-b7de-9f38e20635ab', 'e54348a6-5f2e-4472-9d44-1d699c50bfb4', 'CHEQUE_REPORT', 'Report of Cheque Issued', 'Report of Checks issued with supporting documents for ASC, signed by Disbursing Officer, approved by the Finance Officer or Authorized Official (Annex 9);', NULL, 'The attached report of checks issued, with supporting documents for ASC, must be signed by the Disbursing Officer and approved by the Finance Officer or Authorized Official (Annex 9) Proceed with upload?', 4, 1, 1, '2026-03-23 02:17:45', '2026-03-23 08:04:48'),
('453f9999-7cf7-47ba-9bcb-f98a7e40160b', '49f6eb41-cd42-4359-b2b2-f0895af7c383', 'PR', 'Proof of Receipt', 'Original copy of Official Receipt (OR) of grant released by the CHEDRO', NULL, NULL, 0, 1, 1, '2026-03-23 18:42:12', '2026-03-23 18:42:12'),
('46404542-6ba2-4948-8bf3-cadddf7a9f2e', 'c600e60e-9d72-48a6-9f50-710f468309fe', 'CORA', 'Certificate of Registration with Assessment', 'Original or certified true copy of Certificate of Registration with assessment', NULL, 'Please upload complete and approriate document', 0, 1, 1, '2026-03-23 17:52:30', '2026-03-23 17:52:40'),
('4b3425e8-d51a-416e-966d-6f158af26f29', 'e54348a6-5f2e-4472-9d44-1d699c50bfb4', 'OR_ASC_MGMT', 'Official Receipt for the use of ASC or Management Fee', 'Administrative Support Cost (ASC)\r\nThe ASC for HEIs, shall cover expenses on monitoring, notarization of legal documents, office supplies and materials, hiring of project technical staff/s or job order, communication, transportation / travel, remedial / mentoring program and meetings / orientation / general assembly and cash cards that will be issued to the TES student-grantees. Also, see Memorandum Circular No. 3 series of 2024 for the detailed allowable expenses and required attachments.\r\n\r\n\r\nManagement Fee\r\nOfficial receipt issued by the HEI duly signed by the  Finance Officer or Authorized Official of the  HEI for the receipt of fund (Effective starting Academic Year 2024-2025 and onwards)', NULL, 'The attached Official Receipt and other supporting documents for the ASC or Management Fee must be complete and duly signed/authorized. Proceed with upload?', 3, 1, 1, '2026-03-23 02:17:45', '2026-03-23 08:00:31'),
('4d5427d5-6c7f-4de0-a9e7-b29930e44091', 'e54348a6-5f2e-4472-9d44-1d699c50bfb4', 'SCHOOL_ID', 'School Identification Card', 'Must have three (3) specimen signatures of the student-grantee. Specimen signatures must be the same signature appearing in the student-grantee\'s school ID', NULL, 'The attached ID must have 3 specimen signatures of the student-grantee, same as on the school ID. Proceed with upload?', 9, 1, 1, '2026-03-23 02:17:45', '2026-03-23 08:11:43'),
('4da8b993-bd64-491c-b0a3-af9e15373635', 'b92ec35b-6304-4e1b-a149-aa3330219fb4', 'OR', 'Official Receipt of the utilized/returned ASC', 'Original/Certified True Copy of the Official Receipt of the utilized/returned Administrative Cost', NULL, NULL, 0, 1, 1, '2026-03-23 18:31:44', '2026-03-23 18:31:44'),
('4ddc8d41-c06a-4b66-b57e-eb33e9ddf765', '49f6eb41-cd42-4359-b2b2-f0895af7c383', 'SID', 'School Identification Card', 'Copy of School ID (front and back)', NULL, 'Please upload complete documents.', 0, 1, 1, '2026-03-23 18:45:56', '2026-03-23 18:45:56'),
('4e26cc68-d3c6-4734-922f-90aba7944d2e', 'b92ec35b-6304-4e1b-a149-aa3330219fb4', 'SID', 'School Identification Card', 'Original/Certified True Copy of School Identification Card', NULL, 'Please upload complete documents.', 0, 1, 1, '2026-03-23 18:30:39', '2026-03-23 18:30:39'),
('6570c333-2559-4758-b402-70945883137b', '53c5c334-0a20-4f3e-a1e2-3ec0cd178540', 'LRF', 'Liquidation Report Form', 'Annex F-7 Liquidation Report Form duly signed by grantees (1 Original copy, 2 Certified True Photocopy)', NULL, 'Please ensure that all grantees have signed.\nIf there is a returned fund, attach a photocopy of the Official Receipt (OR).', 0, 1, 1, '2026-03-23 17:58:47', '2026-03-23 17:58:47'),
('6b241d51-09ba-4f02-bebc-0da093477e82', 'd167bed7-fd80-4936-b014-6210584205ba', 'BF', 'Billing Form', 'Billing Form duly signed by grantees (1 Original copy, 2 Certified True Photocopy)', NULL, NULL, 0, 1, 1, '2026-03-23 18:20:19', '2026-03-23 18:20:19'),
('78795877-358b-4cab-a317-f2f8e1624670', 'e54348a6-5f2e-4472-9d44-1d699c50bfb4', 'BILLING_DOCS', 'Billing Documents', 'Attach the updated Billing documents received from CHED\'s Cashier\'s Office', NULL, 'The attached updated billing documents must be received from CHED\'s Cashier\'s Office. Proceed with upload?', 6, 1, 1, '2026-03-23 02:17:45', '2026-03-23 08:09:48'),
('7b7dbdc9-f76a-4438-8c0f-1078d37a4ea9', 'a9c8ffd8-637d-4c50-85e4-778934730ccf', 'SHARING_ANNEX10', 'Sharing Agreement or Annex 10', 'Sharing Agreement - Applicable for Academic Years  2018-2019 to 1st semester Academic Year 2021-2022\r\n\r\nAnnex 10: Certified List of Tertiary Education Subsidy (TES) Grantees with Notarized TES Sharing Agreement starting 2nd semester Academic Year 2021-2022 and onwards\r\n\r\nApplicable Batch: Batch 1 Grantees (P30,000.00 stipend)', NULL, 'Attach the signed sharing agreement, if applicable. Proceed with upload?', 8, 1, 1, '2026-03-23 02:17:45', '2026-03-23 07:55:41'),
('7fa257b3-1e2c-4342-b183-15340f845b28', '49f6eb41-cd42-4359-b2b2-f0895af7c383', 'COE-COR', 'Certificate of Enrollment (COE) or Certificate of Registration (COR)', 'Individual copy of Certificate of Registration /Enrollment of each scholar', NULL, 'Please upload complete documents.', 0, 1, 1, '2026-03-23 18:47:10', '2026-03-23 18:47:10'),
('86c6dd91-7759-4b56-8ead-6b94d3f38a21', 'b92ec35b-6304-4e1b-a149-aa3330219fb4', 'COG', 'Certificate of Grades', 'Original/Certified True Copy of Certificate of Grades from previous semester', NULL, 'Please upload complete documents.', 0, 1, 1, '2026-03-23 18:29:25', '2026-03-23 18:29:25'),
('9ac380da-211a-495a-b069-b6fb437f96a9', 'e54348a6-5f2e-4472-9d44-1d699c50bfb4', 'COR_COE', 'Certificate of Registration/Certificate of Enrollment', 'Attach the final Certificate of Registration/Certificate of Enrollment', NULL, 'The attached Certificate of Registration/Certificate of Enrollment must be final. Proceed with upload?', 7, 1, 1, '2026-03-23 02:17:45', '2026-03-23 08:10:06'),
('a08bd7c1-dd0d-423e-b55b-98db91045c7c', '49f6eb41-cd42-4359-b2b2-f0895af7c383', 'SOA', 'Statement of Account (SOA)', 'Individual copy of Individual Statement of Account (SOA) showing that the amount received from CHED was deducted from the TOSF of the scholar', NULL, 'Please upload complete documents.', 0, 1, 1, '2026-03-23 18:48:35', '2026-03-23 18:48:35'),
('a24165c6-e737-466a-9b63-ae28974e405e', 'a9c8ffd8-637d-4c50-85e4-778934730ccf', 'CHEQUE_REPORT', 'Report of Cheque Issued', 'Report of Checks issued with supporting documents for ASC, signed by Disbursing Officer, approved by the Finance Officer or Authorized Official (Annex 9);', NULL, 'The attached report of checks issued, with supporting documents for ASC, must be signed by the Disbursing Officer and approved by the Finance Officer or Authorized Official (Annex 9) Proceed with upload?', 4, 1, 1, '2026-03-23 02:17:45', '2026-03-23 07:53:17'),
('a26a22ac-a144-4194-9a20-dc853d01d88e', 'a9c8ffd8-637d-4c50-85e4-778934730ccf', 'COR_COE', 'Certificate of Registration/Certificate of Enrollment', 'Attach the final Certificate of Registration/Certificate of Enrollment', NULL, 'The attached Certificate of Registration/Certificate of Enrollment must be final. Proceed with upload?', 7, 1, 1, '2026-03-23 02:17:45', '2026-03-23 07:55:15'),
('a29714f5-21e0-4926-ad63-ab51baf809a6', 'a9c8ffd8-637d-4c50-85e4-778934730ccf', 'SCHOOL_ID', 'School Identification Card', 'Must have three (3) specimen signatures of the student-grantee. Specimen signatures must be the same signature appearing in the student-grantee\'s school ID', NULL, 'The attached ID must have 3 specimen signatures of the student-grantee, same as on the school ID. Proceed with upload?', 9, 1, 1, '2026-03-23 02:17:45', '2026-03-23 07:56:00'),
('aa614ab6-2830-4071-bd72-e1a969142238', '49f6eb41-cd42-4359-b2b2-f0895af7c383', 'SP', 'Signed Payroll', 'Signed Payroll (refer to Form No. 9) or any proof of payment that the scholar received the allowance', NULL, 'Please ensure that all scholars have signed.\nIf there is a returned fund, attach a Certified True Copy of the Official Receipt (OR).', 0, 1, 1, '2026-03-23 18:50:48', '2026-03-23 18:50:48'),
('c2c04aed-ccef-4765-bee9-b4057395ce76', 'e54348a6-5f2e-4472-9d44-1d699c50bfb4', 'TRANSMITTAL', 'Transmittal', 'Should be duly signed by the president or head of HEI', NULL, 'The attached transmittal letter must be duly signed by the President/Head of your HEI. Proceed with upload?', 1, 1, 1, '2026-03-23 02:17:45', '2026-03-23 07:58:52'),
('c9f11a82-5949-4d2b-bff1-4f71988928df', 'df19c886-3e3b-44c9-89ae-d682ec2982d2', 'BF', 'Billing Form', 'Billing Form duly signed by the grantees (1 Original copy, 2 Certified True Photocopy)', NULL, 'Please ensure that all grantees have signed.\nIf there is a returned fund, attach a Certified True Copy of the Official Receipt (OR).', 0, 1, 1, '2026-03-23 18:23:22', '2026-03-23 18:23:22'),
('d736127f-5acc-41a2-a03b-a4b9ef65b70b', 'e54348a6-5f2e-4472-9d44-1d699c50bfb4', 'FUR', 'Fund Utilization Report', NULL, 'document_requirements/G2QhMW2ORPeaJj1l1kwTcf0XiCKCHgMHuYuUSPsS.png', 'The attached Fund Utilization Report must be complete and duly signed by the authorized official of your HEI. Proceed with upload?', 2, 1, 1, '2026-03-23 02:17:45', '2026-03-23 07:59:12'),
('d8a238fc-bcb6-4b75-a1a8-95633848195f', 'a9c8ffd8-637d-4c50-85e4-778934730ccf', 'OR_ASC_MGMT', 'Official Receipt for the use of ASC or Management Fee', 'Administrative Support Cost (ASC)\r\nThe ASC for HEIs, shall cover expenses on monitoring, notarization of legal documents, office supplies and materials, hiring of project technical staff/s or job order, communication, transportation / travel, remedial / mentoring program and meetings / orientation / general assembly and cash cards that will be issued to the TES student-grantees. Also, see Memorandum Circular No. 3 series of 2024 for the detailed allowable expenses and required attachments.\r\n\r\n\r\nManagement Fee\r\nOfficial receipt issued by the HEI duly signed by the  Finance Officer or Authorized Official of the  HEI for the receipt of fund (Effective starting Academic Year 2024-2025 and onwards)', NULL, 'The attached Official Receipt and other supporting documents for the ASC or Management Fee must be complete and duly signed/authorized. Proceed with upload?', 3, 1, 1, '2026-03-23 02:17:45', '2026-03-23 08:00:14'),
('dabd44ff-b8e4-4d7e-a559-33b07a473f02', 'a9c8ffd8-637d-4c50-85e4-778934730ccf', 'OR_REFUND', 'Official Receipt for Refund', 'Attach scanned copy of refund for unutilized Adminisitrative Support Cost or unclaimed student-grantee\'s stipend', NULL, 'The attached scanned copy of refund for unutilized Administrative Support Cost or unclaimed student-grantee\'s stipend, must be complete and final, if any. Proceed with upload?', 10, 1, 0, '2026-03-23 02:17:45', '2026-03-23 08:12:57'),
('db72dc12-1e6f-47a7-ae9b-b30b18cc1e5c', 'e54348a6-5f2e-4472-9d44-1d699c50bfb4', 'SHARING_ANNEX10', 'Sharing Agreement or Annex 10', 'Sharing Agreement - Applicable for Academic Years  2018-2019 to 1st semester Academic Year 2021-2022\r\n\r\nAnnex 10: Certified List of Tertiary Education Subsidy (TES) Grantees with Notarized TES Sharing Agreement starting 2nd semester Academic Year 2021-2022 and onwards\r\n\r\nApplicable Batch: Batch 1 Grantees (P30,000.00 stipend)', NULL, 'Attach the signed sharing agreement, if applicable. Proceed with upload?', 8, 1, 1, '2026-03-23 02:17:45', '2026-03-23 08:10:47'),
('dc5c6336-c1c4-4b23-9f6e-d0ab388337d9', 'a9c8ffd8-637d-4c50-85e4-778934730ccf', 'FUR', 'Fund Utilization Report', NULL, 'document_requirements/61lDkz4Sblw74JmdGd8o3pS21dG4gIlWWqNh0nnE.png', 'The attached Fund Utilization Report must be complete and duly signed by the authorized official of your HEI. Proceed with upload?', 2, 1, 1, '2026-03-23 02:17:45', '2026-03-23 07:48:55'),
('e52a0bb3-17a0-459b-9ac9-e566f8d4b1cb', 'b92ec35b-6304-4e1b-a149-aa3330219fb4', 'SPPR', 'Signed Payroll or Proof of Receipt', 'Original/Certified True Copy of Signed Payroll or any proof of receipt of allowance', NULL, 'Please ensure that all grantees have signed.', 0, 1, 1, '2026-03-23 18:30:00', '2026-03-23 18:30:00'),
('eaf5d9a9-a916-44d5-b77f-702cfa77dd17', 'e54348a6-5f2e-4472-9d44-1d699c50bfb4', 'OR_REFUND', 'Official Receipt for Refund', 'Attach scanned copy of refund for unutilized Adminisitrative Support Cost or unclaimed student-grantee\'s stipend', NULL, 'The attached scanned copy of refund for unutilized Administrative Support Cost or unclaimed student-grantee\'s stipend, must be complete and final, if any. Proceed with upload?', 10, 1, 0, '2026-03-23 02:17:45', '2026-03-23 08:12:47'),
('ebafc361-2ee6-4b94-a706-59c6c9cb24da', 'e54348a6-5f2e-4472-9d44-1d699c50bfb4', 'PROOF_DISBURSEMENT', 'Proof of Disbursement (General Payroll/Bank Transfer/Money Remittance)', NULL, 'document_requirements/PWdrT0LDFAvFKLXR5Q7K9svIYP95NfQCyNhxwlby.png', 'The attached proof of Disbursement (General Payroll / Bank Transfer / Money Remittance) must be complete and duly signed. Proceed with upload?', 5, 1, 1, '2026-03-23 02:17:45', '2026-03-23 08:05:20'),
('ec1b84ca-dd76-456b-b832-91336f6ca7a4', 'a9c8ffd8-637d-4c50-85e4-778934730ccf', 'PROOF_DISBURSEMENT', 'Proof of Disbursement (General Payroll/Bank Transfer/Money Remittance)', NULL, 'document_requirements/WdkJ2LX5zOTTSUyTccVDaLwtpQdhq3xrs4xB23b2.png', 'The attached proof of Disbursement (General Payroll / Bank Transfer / Money Remittance) must be complete and duly signed. Proceed with upload?', 5, 1, 1, '2026-03-23 02:17:45', '2026-03-23 07:54:01'),
('f08af5fd-87b5-49c4-90d7-62d8ff01b9d7', '53c5c334-0a20-4f3e-a1e2-3ec0cd178540', 'TRANSMITTAL', 'Transmittal', 'Transmittal', NULL, 'The attached transmittal letter must be duly signed by the President/Head of your HEI.', 0, 1, 1, '2026-03-23 17:57:56', '2026-03-23 17:57:56'),
('f0ac0a3b-2a44-405d-bd82-bc9801a782cd', '49f6eb41-cd42-4359-b2b2-f0895af7c383', 'TRANSMITTAL', 'Transmittal letter', 'Transmittal letter', NULL, NULL, 0, 1, 1, '2026-03-23 18:41:27', '2026-03-23 18:41:27'),
('fe119d28-021f-4e73-8b62-35183c4a3c4c', '53c5c334-0a20-4f3e-a1e2-3ec0cd178540', 'BF', 'Billing Form', 'Billing Form duly signed by grantees (1 Original copy, 2 Certified True Photocopy)', NULL, 'Please ensure that all grantees have signed.\nIf there is a returned fund, attach a photocopy of the Official Receipt (OR).', 0, 1, 1, '2026-03-23 18:01:38', '2026-03-23 18:01:38');

-- --------------------------------------------------------

--
-- Table structure for table `document_statuses`
--

CREATE TABLE IF NOT EXISTS `document_statuses` (
  `id` char(36) NOT NULL,
  `code` varchar(30) NOT NULL,
  `name` varchar(50) NOT NULL,
  `description` varchar(255) DEFAULT NULL,
  `badge_color` varchar(20) NOT NULL DEFAULT 'gray',
  `sort_order` int(11) NOT NULL DEFAULT 0,
  `is_active` tinyint(1) NOT NULL DEFAULT 1,
  `created_at` timestamp NULL DEFAULT NULL,
  `updated_at` timestamp NULL DEFAULT NULL,
  PRIMARY KEY (`id`),
  UNIQUE KEY `document_statuses_code_unique` (`code`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

--
-- RELATIONSHIPS FOR TABLE `document_statuses`:
--

--
-- Dumping data for table `document_statuses`
--

INSERT INTO `document_statuses` (`id`, `code`, `name`, `description`, `badge_color`, `sort_order`, `is_active`, `created_at`, `updated_at`) VALUES
('8964073b-1f4c-4c2a-a332-d3132264e45b', 'PARTIAL', 'Partial Submission', NULL, 'yellow', 2, 1, '2026-03-23 02:17:41', '2026-03-23 02:17:41'),
('c2f45555-e53f-4f93-8c70-fb9ae29df1c9', 'COMPLETE', 'Complete Submission', NULL, 'green', 1, 1, '2026-03-23 02:17:41', '2026-03-23 02:17:41'),
('fc1df285-5d8e-4d90-89e5-06dd3280ae1a', 'NONE', 'No Submission', NULL, 'gray', 3, 1, '2026-03-23 02:17:41', '2026-03-23 02:17:41');

-- --------------------------------------------------------

--
-- Table structure for table `failed_jobs`
--

CREATE TABLE IF NOT EXISTS `failed_jobs` (
  `id` bigint(20) UNSIGNED NOT NULL AUTO_INCREMENT,
  `uuid` varchar(255) NOT NULL,
  `connection` text NOT NULL,
  `queue` text NOT NULL,
  `payload` longtext NOT NULL,
  `exception` longtext NOT NULL,
  `failed_at` timestamp NOT NULL DEFAULT current_timestamp(),
  PRIMARY KEY (`id`),
  UNIQUE KEY `failed_jobs_uuid_unique` (`uuid`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

--
-- RELATIONSHIPS FOR TABLE `failed_jobs`:
--

-- --------------------------------------------------------

--
-- Table structure for table `heis`
--

CREATE TABLE IF NOT EXISTS `heis` (
  `id` char(36) NOT NULL,
  `uii` varchar(255) NOT NULL COMMENT 'Unique Institutional Identifier',
  `code` varchar(255) DEFAULT NULL COMMENT 'HEI Code',
  `name` varchar(255) NOT NULL,
  `type` enum('Private','SUC','LUC') NOT NULL COMMENT 'Private, SUC (State University Colleges), LUC (Local University Colleges)',
  `region_id` char(36) DEFAULT NULL,
  `logo` varchar(255) DEFAULT NULL COMMENT 'Path to HEI logo/avatar',
  `status` enum('active','inactive') NOT NULL DEFAULT 'active',
  `created_at` timestamp NULL DEFAULT NULL,
  `updated_at` timestamp NULL DEFAULT NULL,
  PRIMARY KEY (`id`),
  UNIQUE KEY `heis_uii_unique` (`uii`),
  KEY `heis_region_id_foreign` (`region_id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

--
-- RELATIONSHIPS FOR TABLE `heis`:
--   `region_id`
--       `regions` -> `id`
--

--
-- Dumping data for table `heis`
--

INSERT INTO `heis` (`id`, `uii`, `code`, `name`, `type`, `region_id`, `logo`, `status`, `created_at`, `updated_at`) VALUES
('02c68d21-5e26-40d8-97bc-dce0288c492a', '12030', NULL, 'MINDANAO STATE UNIVERSITY-LANAO NATIONAL COLLEGE OF ARTS AND TRADES', 'SUC', '28fbd0bf-3ac5-40ba-8148-a74ae4897ab2', NULL, 'active', '2026-03-23 02:17:44', '2026-03-23 02:17:44'),
('03029d17-5782-4595-995a-8e83e7027b80', '11029', NULL, 'GENSANTOS FOUNDATION COLLEGE, INC.', 'Private', '6345f5e4-54cf-496c-9a9f-c0ef8afce3ab', NULL, 'active', '2026-03-23 02:17:44', '2026-03-23 02:17:44'),
('04c40f35-a34b-4bc5-ae0d-eab706c01a1a', '12124', NULL, 'I-LINK COLLEGE OF SCIENCE AND TECHNOLOGY INC.', 'Private', '6345f5e4-54cf-496c-9a9f-c0ef8afce3ab', NULL, 'active', '2026-03-23 02:17:44', '2026-03-23 02:17:44'),
('065baaa0-f2bf-4da4-b7dc-aa2768198b43', '12117', NULL, 'ASIAN COLLEGES AND TECHNOLOGICAL INSTITUTE, INC', 'Private', '6345f5e4-54cf-496c-9a9f-c0ef8afce3ab', NULL, 'active', '2026-03-23 02:17:44', '2026-03-23 02:17:44'),
('08649e40-f794-44f1-a28c-a3549e52bc3a', '15012', NULL, 'SULTAN KUDARAT ISLAMIC ACADEMY FOUNDATION COLLEGE', 'Private', '28fbd0bf-3ac5-40ba-8148-a74ae4897ab2', NULL, 'active', '2026-03-23 02:17:44', '2026-03-23 02:17:44'),
('0c088fe5-b729-44c5-9b0b-59e5eec1f931', '15010', NULL, 'PARANG FOUNDATION COLLEGE', 'Private', '28fbd0bf-3ac5-40ba-8148-a74ae4897ab2', NULL, 'active', '2026-03-23 02:17:44', '2026-03-23 02:17:44'),
('0c4c22fc-7edd-4a71-8c5e-575fa80f0156', '12044', NULL, 'UNIVERSITY OF SOUTHERN MINDANAO-KIDAPAWAN CITY CAMPUS', 'SUC', '6345f5e4-54cf-496c-9a9f-c0ef8afce3ab', NULL, 'active', '2026-03-23 02:17:44', '2026-03-23 02:17:44'),
('0d5dd8a8-3f7f-4501-8e21-7912bf658ac9', '12095', NULL, 'DATU MALA MUSLIM MINDANAO ISLAMIC COLLEGE FOUNDATION', 'Private', '28fbd0bf-3ac5-40ba-8148-a74ae4897ab2', NULL, 'active', '2026-03-23 02:17:44', '2026-03-23 02:17:44'),
('10211f7f-de3d-40c9-be6a-b051b2574b44', '15038', NULL, 'CALI PARAMEDICAL COLLEGE FOUNDATION', 'Private', '28fbd0bf-3ac5-40ba-8148-a74ae4897ab2', NULL, 'active', '2026-03-23 02:17:44', '2026-03-23 02:17:44'),
('11d07d03-6eaf-4efb-a8b0-9e776aa0e8c9', '15062', NULL, 'KHADIJAH MOHAMMAD ISLAMIC ACADEMY', 'Private', '28fbd0bf-3ac5-40ba-8148-a74ae4897ab2', NULL, 'active', '2026-03-23 02:17:44', '2026-03-23 02:17:44'),
('128d8341-9569-4b1f-b15d-a0bac78895b5', '15011', NULL, 'SHARIFF KABUNSUAN COLLEGE (ANNEX)', 'Private', '28fbd0bf-3ac5-40ba-8148-a74ae4897ab2', NULL, 'active', '2026-03-23 02:17:44', '2026-03-23 02:17:44'),
('15f8422e-d4dc-4d03-bb5e-f24af0bb7db1', '15066', NULL, 'ENTHUSIASTIC COLLEGE', 'Private', '28fbd0bf-3ac5-40ba-8148-a74ae4897ab2', NULL, 'active', '2026-03-23 02:17:44', '2026-03-23 02:17:44'),
('196d3db8-641b-46d4-b1b3-ff4a4ed6b4c6', '12170', NULL, 'SOUTH ASIATECH COLLEGE, INC.', 'Private', '6345f5e4-54cf-496c-9a9f-c0ef8afce3ab', NULL, 'active', '2026-03-23 02:17:44', '2026-03-23 02:17:44'),
('19c040a5-b4aa-4098-955a-e4af6d0a5ef2', '12140', NULL, 'CRONASIA FOUNDATION COLLEGE, INC.', 'Private', '6345f5e4-54cf-496c-9a9f-c0ef8afce3ab', NULL, 'active', '2026-03-23 02:17:44', '2026-03-23 02:17:44'),
('1afe3322-b07c-4c08-9a2a-db380ba74842', '12008', NULL, 'COTABATO FOUNDATION COLLEGE OF SCIENCE AND TECHNOLOGY', 'SUC', '6345f5e4-54cf-496c-9a9f-c0ef8afce3ab', NULL, 'active', '2026-03-23 02:17:44', '2026-03-23 02:17:44'),
('1b2eb102-bc9d-4e4f-afb2-96f5af732b3c', '12050', NULL, 'NOTRE DAME OF MIDSAYAP COLLEGE', 'Private', '6345f5e4-54cf-496c-9a9f-c0ef8afce3ab', NULL, 'active', '2026-03-23 02:17:44', '2026-03-23 02:17:44'),
('1b8d41bc-e13b-46ee-bc2b-7d4a8371bd07', '12022', NULL, 'JAMIATU MUSLIM MINDANAO', 'Private', '28fbd0bf-3ac5-40ba-8148-a74ae4897ab2', NULL, 'active', '2026-03-23 02:17:44', '2026-03-23 02:17:44'),
('1bf4246e-f4ad-4b38-9337-403a639dcf26', '15001', NULL, 'GANI L. ABPI COLLEGE', 'Private', '28fbd0bf-3ac5-40ba-8148-a74ae4897ab2', NULL, 'active', '2026-03-23 02:17:44', '2026-03-23 02:17:44'),
('20edb338-c324-478f-891c-8849ae333a2e', '12040', NULL, 'MINDANAO STATE UNIVERSITY-MAIN CAMPUS MARAWI CITY', 'SUC', '28fbd0bf-3ac5-40ba-8148-a74ae4897ab2', NULL, 'active', '2026-03-23 02:17:44', '2026-03-23 02:17:44'),
('21f29149-7b3e-4fd3-97f6-5d91adc9b82c', '11024', NULL, 'EDENTON MISSION COLLEGE, INC.', 'Private', '6345f5e4-54cf-496c-9a9f-c0ef8afce3ab', NULL, 'active', '2026-03-23 02:17:44', '2026-03-23 02:17:44'),
('2326dd3c-fae6-4edd-b2ad-99e72f20b2fe', '12169', NULL, 'MALAPATAN COLLEGE OF SCIENCE AND TECHNOLOGY', 'LUC', '6345f5e4-54cf-496c-9a9f-c0ef8afce3ab', NULL, 'active', '2026-03-23 02:17:44', '2026-03-23 02:17:44'),
('26cda09a-eddd-40c7-a57a-b81f4eed9c81', '15056', NULL, 'RC-AL KHWARIZMI INTERNATIONAL COLLEGE FOUNDATION', 'Private', '28fbd0bf-3ac5-40ba-8148-a74ae4897ab2', NULL, 'active', '2026-03-23 02:17:44', '2026-03-23 02:17:44'),
('29fef77f-59aa-4d0c-8ba5-13456d89a016', '12074', NULL, 'SULTAN KUDARAT STATE UNIVERSITY', 'SUC', '6345f5e4-54cf-496c-9a9f-c0ef8afce3ab', NULL, 'active', '2026-03-23 02:17:44', '2026-03-23 02:17:44'),
('30531a9d-06e1-4fe7-81e2-0d3e31bfb4f0', '12010', NULL, 'COTABATO MEDICAL FOUNDATION COLLEGE, INCORPORATED', 'Private', '6345f5e4-54cf-496c-9a9f-c0ef8afce3ab', NULL, 'active', '2026-03-23 02:17:44', '2026-03-23 02:17:44'),
('31e20390-7bb0-43b4-8a61-b324cbc35ddd', '12074c', NULL, 'SULTAN KUDARAT STATE UNIVERSITY - KALAMANSIG', 'SUC', '6345f5e4-54cf-496c-9a9f-c0ef8afce3ab', NULL, 'active', '2026-03-23 02:17:44', '2026-03-23 02:17:44'),
('328188e7-d3d2-4424-acb6-d1fb622f8b98', '12021', NULL, 'JAMIATU MARAWI AL-ISLAMIA FOUNDATION', 'Private', '28fbd0bf-3ac5-40ba-8148-a74ae4897ab2', NULL, 'active', '2026-03-23 02:17:44', '2026-03-23 02:17:44'),
('38590d96-ca41-4bf8-a5c4-021620c25187', '12163', NULL, 'KING SOLOMON INSTITUTE, INC.', 'Private', '6345f5e4-54cf-496c-9a9f-c0ef8afce3ab', NULL, 'active', '2026-03-23 02:17:44', '2026-03-23 02:17:44'),
('396d951a-e55e-47b6-a77e-fd58e349c847', '12150', NULL, 'FILIPINO CANADIAN COMMUNITY COLLEGE FOUNDATION INCORPORATED', 'Private', '6345f5e4-54cf-496c-9a9f-c0ef8afce3ab', NULL, 'active', '2026-03-23 02:17:44', '2026-03-23 02:17:44'),
('399ee670-55c0-47b2-b555-c9964307bf5e', '12151', NULL, 'NEW ERA UNIVERSITY, GENERAL SANTOS CITY BRANCH', 'Private', '6345f5e4-54cf-496c-9a9f-c0ef8afce3ab', NULL, 'active', '2026-03-23 02:17:44', '2026-03-23 02:17:44'),
('3bd121f6-6179-412e-b0cb-7d9d5a8e0bb9', '12142', NULL, 'KIDAPAWAN DOCTORS COLLEGE, INCORPORATED', 'Private', '6345f5e4-54cf-496c-9a9f-c0ef8afce3ab', NULL, 'active', '2026-03-23 02:17:44', '2026-03-23 02:17:44'),
('3e2b0d60-633c-476b-960f-872b69965ab4', '15064', NULL, 'LANAO CENTRAL COLLEGE', 'Private', '28fbd0bf-3ac5-40ba-8148-a74ae4897ab2', NULL, 'active', '2026-03-23 02:17:44', '2026-03-23 02:17:44'),
('407c263e-0d20-4786-9961-3f0798a64120', '15033', NULL, 'SAL FOUNDATION COLLEGE', 'Private', '28fbd0bf-3ac5-40ba-8148-a74ae4897ab2', NULL, 'active', '2026-03-23 02:17:44', '2026-03-23 02:17:44'),
('4128ba0b-c4b8-442a-beba-dafe21f78fa0', '15006', NULL, 'MINDANAO STATE UNIVERSITY - MAGUINDANAO', 'SUC', '28fbd0bf-3ac5-40ba-8148-a74ae4897ab2', NULL, 'active', '2026-03-23 02:17:44', '2026-03-23 02:17:44'),
('418ef6da-5092-410b-816e-417b66c1655a', '12120', NULL, 'ACLC COLLEGE OF MARBEL', 'Private', '6345f5e4-54cf-496c-9a9f-c0ef8afce3ab', NULL, 'active', '2026-03-23 02:17:44', '2026-03-23 02:17:44'),
('43d94704-8276-4dcd-ba04-7076ae0d7dfd', '15023', NULL, 'DEL SUR GOOD SHEPHERD COLLEGE', 'Private', '28fbd0bf-3ac5-40ba-8148-a74ae4897ab2', NULL, 'active', '2026-03-23 02:17:44', '2026-03-23 02:17:44'),
('4528da7e-9592-4e08-b69b-c4ace66b18d6', '12105', NULL, 'GOLDENSTATE COLLEGE', 'Private', '6345f5e4-54cf-496c-9a9f-c0ef8afce3ab', NULL, 'active', '2026-03-23 02:17:44', '2026-03-23 02:17:44'),
('49b1a074-ec48-4c9a-9f8d-cfaecadf97f7', '12116', NULL, 'VMC ASIAN COLLEGE FOUNDATION, INC.', 'Private', '6345f5e4-54cf-496c-9a9f-c0ef8afce3ab', NULL, 'active', '2026-03-23 02:17:44', '2026-03-23 02:17:44'),
('4cf9d9b8-71bc-4de3-b0c7-cf64985451f5', '15061', NULL, 'ILLANA BAY INTEGRATED COMPUTER COLLEGE', 'Private', '28fbd0bf-3ac5-40ba-8148-a74ae4897ab2', NULL, 'active', '2026-03-23 02:17:44', '2026-03-23 02:17:44'),
('53732b52-a95c-4043-b83e-1a92635e6828', '11048', NULL, 'MINDANAO STATE UNIVERSITY - GENERAL SANTOS CITY', 'SUC', '6345f5e4-54cf-496c-9a9f-c0ef8afce3ab', NULL, 'active', '2026-03-23 02:17:44', '2026-03-23 02:17:44'),
('561266fe-ec7f-4fda-8113-d191cf9dd3a3', '12064', NULL, 'SENATOR NINOY AQUINO COLLEGE FOUNDATION, INC.', 'Private', '6345f5e4-54cf-496c-9a9f-c0ef8afce3ab', NULL, 'active', '2026-03-23 02:17:44', '2026-03-23 02:17:44'),
('56ef9917-15a7-489c-922e-bc56f82818ca', '15031', NULL, 'DANSALAN POLYTECHNIC COLLEGE', 'Private', '28fbd0bf-3ac5-40ba-8148-a74ae4897ab2', NULL, 'active', '2026-03-23 02:17:44', '2026-03-23 02:17:44'),
('5a2215b5-be47-4c84-8245-f1682672ca58', '12035', NULL, 'MARAWI CAPITOL COLLEGE FOUNDATION', 'Private', '28fbd0bf-3ac5-40ba-8148-a74ae4897ab2', NULL, 'active', '2026-03-23 02:17:44', '2026-03-23 02:17:44'),
('5d9510a5-7247-4c38-8f8c-57a0148f8409', '12074f', NULL, 'SULTAN KUDARAT STATE UNIVERSITY - PALIMBANG', 'SUC', '6345f5e4-54cf-496c-9a9f-c0ef8afce3ab', NULL, 'active', '2026-03-23 02:17:44', '2026-03-23 02:17:44'),
('601fe1bc-3c20-42fa-899e-8acf07518842', '12006', NULL, 'COTABATO STATE UNIVERSITY', 'SUC', '28fbd0bf-3ac5-40ba-8148-a74ae4897ab2', NULL, 'active', '2026-03-23 02:17:44', '2026-03-23 02:17:44'),
('61161611-e8c1-4bcc-9e8b-7b2de8cad1c7', '11113', NULL, 'GREEN VALLEY COLLEGE FOUNDATION, INC.', 'Private', '6345f5e4-54cf-496c-9a9f-c0ef8afce3ab', NULL, 'active', '2026-03-23 02:17:44', '2026-03-23 02:17:44'),
('611a4921-1e42-4f58-98f6-68890faad4b4', '12074a', NULL, 'SULTAN KUDARAT STATE UNIVERSITY - ISULAN', 'SUC', '6345f5e4-54cf-496c-9a9f-c0ef8afce3ab', NULL, 'active', '2026-03-23 02:17:44', '2026-03-23 02:17:44'),
('62b15643-20cd-4b01-9b97-314d05748246', '12119', NULL, 'STRATFORD INTERNATIONAL SCHOOL', 'Private', '6345f5e4-54cf-496c-9a9f-c0ef8afce3ab', NULL, 'active', '2026-03-23 02:17:44', '2026-03-23 02:17:44'),
('64b07928-68d7-4fb1-97d1-2c5f42571521', '12167', NULL, 'NEW HOPE SCHOOL OF AGRICULTURE AND FISHERY, INC.', 'Private', '6345f5e4-54cf-496c-9a9f-c0ef8afce3ab', NULL, 'active', '2026-03-23 02:17:44', '2026-03-23 02:17:44'),
('67161c8e-59fb-498b-a72a-98b7e6ed3bc6', '15071', NULL, 'AS-SALIHEIN INTEGRATED SCHOOL FOUNDATION, INC.', 'Private', '28fbd0bf-3ac5-40ba-8148-a74ae4897ab2', NULL, 'active', '2026-03-23 02:17:44', '2026-03-23 02:17:44'),
('6a347e02-2285-4e2a-bae2-0a59479bc055', '12072', NULL, 'SULTAN KUDARAT EDUCATIONAL INSTITUTION', 'Private', '6345f5e4-54cf-496c-9a9f-c0ef8afce3ab', NULL, 'active', '2026-03-23 02:17:44', '2026-03-23 02:17:44'),
('6bfcf3fb-429f-4bb1-8f23-5c8122ba4760', '12069', NULL, 'SOUTHERN PHILIPPINES METHODIST COLLEGES, INC.', 'Private', '6345f5e4-54cf-496c-9a9f-c0ef8afce3ab', NULL, 'active', '2026-03-23 02:17:44', '2026-03-23 02:17:44'),
('6c9c0be8-541e-44a3-bd50-03ddb828f627', '15070', NULL, 'AL BANGSAMORO SHARI\'AH AND PROFESSIONAL EDUCATION COLLEGE', 'Private', '28fbd0bf-3ac5-40ba-8148-a74ae4897ab2', NULL, 'active', '2026-03-23 02:17:44', '2026-03-23 02:17:44'),
('6cb1399e-24de-48e8-a17c-8461afb3eff9', '12025', NULL, 'KING\'S COLLEGE OF ISULAN', 'Private', '6345f5e4-54cf-496c-9a9f-c0ef8afce3ab', NULL, 'active', '2026-03-23 02:17:44', '2026-03-23 02:17:44'),
('6d076eba-2999-41dd-aa6d-3815b3542511', '11036', NULL, 'HOLY TRINITY COLLEGE OF GENERAL SANTOS CITY', 'Private', '6345f5e4-54cf-496c-9a9f-c0ef8afce3ab', NULL, 'active', '2026-03-23 02:17:44', '2026-03-23 02:17:44'),
('6d5f6c67-8ecb-4e21-adda-9354290c68e7', '12161', NULL, 'PACIFIC SOUTHBAY COLLEGE, INC.', 'Private', '6345f5e4-54cf-496c-9a9f-c0ef8afce3ab', NULL, 'active', '2026-03-23 02:17:44', '2026-03-23 02:17:44'),
('6d8eaf57-adec-41bf-9729-ed98b3fdd381', '15049', NULL, 'LAKE LANAO COLLEGE', 'Private', '28fbd0bf-3ac5-40ba-8148-a74ae4897ab2', NULL, 'active', '2026-03-23 02:17:44', '2026-03-23 02:17:44'),
('6e4a0456-6fc3-44fd-88a5-f3460e6ff728', '12078', NULL, 'UNIVERSITY OF SOUTHERN MINDANAO-MAIN', 'SUC', '6345f5e4-54cf-496c-9a9f-c0ef8afce3ab', NULL, 'active', '2026-03-23 02:17:44', '2026-03-23 02:17:44'),
('70055059-fbc3-4c9d-821e-517d4a8c22da', '15037', NULL, 'DATU IBRAHIM PAGLAS MEMORIAL COLLEGE', 'Private', '28fbd0bf-3ac5-40ba-8148-a74ae4897ab2', NULL, 'active', '2026-03-23 02:17:44', '2026-03-23 02:17:44'),
('72a78a55-628a-49eb-b33d-ee485880f6eb', '12002', NULL, 'CENTRAL MINDANAO COLLEGES', 'Private', '6345f5e4-54cf-496c-9a9f-c0ef8afce3ab', NULL, 'active', '2026-03-23 02:17:44', '2026-03-23 02:17:44'),
('72b8a217-3936-45e2-a19b-2951dd8ee48c', '12146', NULL, 'SOUTHPOINT COLLEGE OF ARTS AND TECHNOLOGY (SPAT), INC.', 'Private', '6345f5e4-54cf-496c-9a9f-c0ef8afce3ab', NULL, 'active', '2026-03-23 02:17:44', '2026-03-23 02:17:44'),
('734a16be-57b6-4f3a-9fd5-5c9b275633cb', '11045', NULL, 'MINDANAO POLYTECHNIC COLLEGE', 'Private', '6345f5e4-54cf-496c-9a9f-c0ef8afce3ab', NULL, 'active', '2026-03-23 02:17:44', '2026-03-23 02:17:44'),
('738e655f-6bc7-41b9-b56b-2e8e5966e5bc', '12005', NULL, 'REGENCY POLYTECHNIC COLLEGE, INC', 'Private', '6345f5e4-54cf-496c-9a9f-c0ef8afce3ab', NULL, 'active', '2026-03-23 02:17:44', '2026-03-23 02:17:44'),
('73d3393d-795b-4e34-a95e-281ee4826f73', '12171', NULL, 'NORTH CIRCLE ACADEMY, INC.', 'Private', '6345f5e4-54cf-496c-9a9f-c0ef8afce3ab', NULL, 'active', '2026-03-23 02:17:44', '2026-03-23 02:17:44'),
('7463732d-3ec6-45da-aae5-9927729ac904', '12144', NULL, 'GENSAN COLLEGE OF TECHNOLOGY, INC.', 'Private', '6345f5e4-54cf-496c-9a9f-c0ef8afce3ab', NULL, 'active', '2026-03-23 02:17:44', '2026-03-23 02:17:44'),
('75d2b0c0-9547-461a-b568-e087a3cfd958', '12114', NULL, 'HOLY CHILD CENTRAL COLLEGES, INC.', 'Private', '6345f5e4-54cf-496c-9a9f-c0ef8afce3ab', NULL, 'active', '2026-03-23 02:17:44', '2026-03-23 02:17:44'),
('7808e6d9-2a2a-4116-9a22-38d034306ccd', '15043', NULL, 'ST. BENEDICT COLLEGE OF MAGUINDANAO', 'Private', '28fbd0bf-3ac5-40ba-8148-a74ae4897ab2', NULL, 'active', '2026-03-23 02:17:44', '2026-03-23 02:17:44'),
('7ceabbfc-f350-46cd-afa7-2634c28417b7', '15040', NULL, 'MARAWI ISLAMIC COLLEGE', 'Private', '28fbd0bf-3ac5-40ba-8148-a74ae4897ab2', NULL, 'active', '2026-03-23 02:17:44', '2026-03-23 02:17:44'),
('7e63149b-cb11-4806-8b71-d656c28761cd', '11116', NULL, 'MARBEL SCHOOL OF SCIENCE AND TECHNOLOGY,INC.', 'Private', '6345f5e4-54cf-496c-9a9f-c0ef8afce3ab', NULL, 'active', '2026-03-23 02:17:44', '2026-03-23 02:17:44'),
('7ee6c389-1ad7-4069-ba21-9d95cd07f226', '12145', NULL, 'PRIMASIA FOUNDATION COLLEGE, INC.', 'Private', '6345f5e4-54cf-496c-9a9f-c0ef8afce3ab', NULL, 'active', '2026-03-23 02:17:44', '2026-03-23 02:17:44'),
('7f1aa846-09db-4036-a3d6-c3001978f0fd', '12164', NULL, 'SANTO NINO COLLEGE FOUNDATION, INC.', 'Private', '6345f5e4-54cf-496c-9a9f-c0ef8afce3ab', NULL, 'active', '2026-03-23 02:17:44', '2026-03-23 02:17:44'),
('7f605f22-f25c-42cc-99b4-9e168d7bcc32', '12165', NULL, 'VMC ASIAN COLLEGE OF PRESIDENT QUIRINO, INC.', 'Private', '6345f5e4-54cf-496c-9a9f-c0ef8afce3ab', NULL, 'active', '2026-03-23 02:17:44', '2026-03-23 02:17:44'),
('803a6c51-94cc-44e8-896e-fd8dd5eefd3f', '12104', NULL, 'ADVENTIST COLLEGE OF TECHNOLOGY, INCORPORATED', 'Private', '6345f5e4-54cf-496c-9a9f-c0ef8afce3ab', NULL, 'active', '2026-03-23 02:17:44', '2026-03-23 02:17:44'),
('84f2c712-2e79-400c-8d6b-943abab896c6', '15068', NULL, 'HADJI DATU SAIDONA PENDATUN FOUNDATION COLLEGE', 'Private', '28fbd0bf-3ac5-40ba-8148-a74ae4897ab2', NULL, 'active', '2026-03-23 02:17:44', '2026-03-23 02:17:44'),
('851447c6-78e7-4f74-9f78-ebdc2eb5fc83', '12086', NULL, 'NORTH VALLEY COLLEGE FOUNDATION, INCORPORATED', 'Private', '6345f5e4-54cf-496c-9a9f-c0ef8afce3ab', NULL, 'active', '2026-03-23 02:17:44', '2026-03-23 02:17:44'),
('869c3be8-5e1a-48ff-a62d-6ed55086dd41', '12045', NULL, 'COLEGIO DE KIDAPAWAN', 'Private', '6345f5e4-54cf-496c-9a9f-c0ef8afce3ab', NULL, 'active', '2026-03-23 02:17:44', '2026-03-23 02:17:44'),
('876c2403-e94b-4911-b861-4bfff80793d8', '12110', NULL, 'NOTRE DAME-SIENA COLLEGE OF POLOMOLOK', 'Private', '6345f5e4-54cf-496c-9a9f-c0ef8afce3ab', NULL, 'active', '2026-03-23 02:17:44', '2026-03-23 02:17:44'),
('87dfe44d-be50-4700-ae45-4abebc67eabd', '12153', NULL, 'GLAN INSTITUTE OF TECHNOLOGY', 'LUC', '6345f5e4-54cf-496c-9a9f-c0ef8afce3ab', NULL, 'active', '2026-03-23 02:17:44', '2026-03-23 02:17:44'),
('8db96160-b978-49f5-8b63-86d3ede110d2', '12136', NULL, 'JOJI ILAGAN INTERNATIONAL SCHOOL OF HOTEL AND TOURISM MANAGEMENT', 'Private', '6345f5e4-54cf-496c-9a9f-c0ef8afce3ab', NULL, 'active', '2026-03-23 02:17:44', '2026-03-23 02:17:44'),
('909170c1-0541-463b-bc76-df8bba1a2135', '12157', NULL, 'GOLDENSTATE COLLEGE OF KIAMBA, INC.', 'Private', '6345f5e4-54cf-496c-9a9f-c0ef8afce3ab', NULL, 'active', '2026-03-23 02:17:44', '2026-03-23 02:17:44'),
('9137737c-253c-41de-a2ff-22b8375651c3', '12074g', NULL, 'SULTAN KUDARAT STATE UNIVERSITY - TACURONG', 'SUC', '6345f5e4-54cf-496c-9a9f-c0ef8afce3ab', NULL, 'active', '2026-03-23 02:17:44', '2026-03-23 02:17:44'),
('931a75f2-394d-427b-b5cb-61048714ff59', '12172', NULL, 'UPM-SCHOOL OF HEALTH SCIENCES KORONADAL CAMPUS', 'SUC', '6345f5e4-54cf-496c-9a9f-c0ef8afce3ab', NULL, 'active', '2026-03-23 02:17:44', '2026-03-23 02:17:44'),
('93410b14-10ef-4273-85e9-0ef3427304b3', '12127', NULL, 'MARVELOUS COLLEGE OF TECHNOLOGY, INC.', 'Private', '6345f5e4-54cf-496c-9a9f-c0ef8afce3ab', NULL, 'active', '2026-03-23 02:17:44', '2026-03-23 02:17:44'),
('93c0ca37-c666-4d95-ba79-00590ff3928a', '12066', NULL, 'SOUTHERN BAPTIST COLLEGE', 'Private', '6345f5e4-54cf-496c-9a9f-c0ef8afce3ab', NULL, 'active', '2026-03-23 02:17:44', '2026-03-23 02:17:44'),
('94745ead-599c-47d7-a932-d1c673cc958b', '15028', NULL, 'LANAO EDUCATIONAL INSTITUTE', 'Private', '28fbd0bf-3ac5-40ba-8148-a74ae4897ab2', NULL, 'active', '2026-03-23 02:17:44', '2026-03-23 02:17:44'),
('95023b4a-f0e9-40ba-9524-63f20bb22d84', '12139', NULL, 'VILLAMOR COLLEGE OF BUSINESS AND ARTS', 'Private', '6345f5e4-54cf-496c-9a9f-c0ef8afce3ab', NULL, 'active', '2026-03-23 02:17:44', '2026-03-23 02:17:44'),
('95489c9e-0ca5-458a-ac28-78fb4111a66d', '12166', NULL, 'ENVIROGREEN SCHOOL OF TECHNOLOGY', 'Private', '6345f5e4-54cf-496c-9a9f-c0ef8afce3ab', NULL, 'active', '2026-03-23 02:17:44', '2026-03-23 02:17:44'),
('96522ef1-401f-4199-8e50-798b49f604e3', '15019', NULL, 'ADIONG MEMORIAL STATE COLLEGE', 'SUC', '28fbd0bf-3ac5-40ba-8148-a74ae4897ab2', NULL, 'active', '2026-03-23 02:17:44', '2026-03-23 02:17:44'),
('97b4ff59-6b55-4424-8120-7c5934aec304', '12074d', NULL, 'SULTAN KUDARAT STATE UNIVERSITY - BAGUMBAYAN', 'SUC', '6345f5e4-54cf-496c-9a9f-c0ef8afce3ab', NULL, 'active', '2026-03-23 02:17:44', '2026-03-23 02:17:44'),
('996a0702-8498-443d-897d-23f69a719264', '11022', NULL, 'ST. ALEXIUS COLLEGE, INC.', 'Private', '6345f5e4-54cf-496c-9a9f-c0ef8afce3ab', NULL, 'active', '2026-03-23 02:17:44', '2026-03-23 02:17:44'),
('9a38b4cb-baf6-4470-9881-33a3dc8624eb', '12115', NULL, 'SOUTH EAST ASIAN INSTITUTE OF TECHNOLOGY, INC.', 'Private', '6345f5e4-54cf-496c-9a9f-c0ef8afce3ab', NULL, 'active', '2026-03-23 02:17:44', '2026-03-23 02:17:44'),
('9ab160bd-b2f5-44bf-a471-31dfc0d88429', '12130', NULL, 'B.E.S.T. COLLEGE OF POLOMOLOK, INC.', 'Private', '6345f5e4-54cf-496c-9a9f-c0ef8afce3ab', NULL, 'active', '2026-03-23 02:17:44', '2026-03-23 02:17:44'),
('9ab91142-5a22-4a2e-9a9a-0d26a0cf1d4f', '12126', NULL, 'GOLDENSTATE COLLEGE OF KORONADAL CITY, INC.', 'Private', '6345f5e4-54cf-496c-9a9f-c0ef8afce3ab', NULL, 'active', '2026-03-23 02:17:44', '2026-03-23 02:17:44'),
('9b68124b-ce66-4c4d-a0d3-2e4ff5acd427', '15057', NULL, 'MINDANAO INSTITUTE OF HEALTHCARE PROFESSIONALS', 'Private', '28fbd0bf-3ac5-40ba-8148-a74ae4897ab2', NULL, 'active', '2026-03-23 02:17:44', '2026-03-23 02:17:44'),
('9d00056c-adc4-47fe-9a8f-7909606f3c44', '11038', NULL, 'KING\'S COLLEGE OF MARBEL, INC.', 'Private', '6345f5e4-54cf-496c-9a9f-c0ef8afce3ab', NULL, 'active', '2026-03-23 02:17:44', '2026-03-23 02:17:44'),
('9d876df3-4c12-417e-94db-78182531654c', '11059', NULL, 'RAMON MAGSAYSAY MEMORIAL COLLEGES', 'Private', '6345f5e4-54cf-496c-9a9f-c0ef8afce3ab', NULL, 'active', '2026-03-23 02:17:44', '2026-03-23 02:17:44'),
('9dd86266-c1e8-4b8c-a077-46f4af8cc735', '12023', NULL, 'JAMIATUL PHILIPPINE AL-ISLAMIA', 'Private', '28fbd0bf-3ac5-40ba-8148-a74ae4897ab2', NULL, 'active', '2026-03-23 02:17:44', '2026-03-23 02:17:44'),
('a10d8bf5-2b56-478a-b5c8-d656883bbc19', '12168', NULL, 'UST GENERAL SANTOS', 'Private', '6345f5e4-54cf-496c-9a9f-c0ef8afce3ab', NULL, 'active', '2026-03-23 02:17:44', '2026-03-23 02:17:44'),
('a27b1e45-b5df-4fe0-8fbf-99c8da325e1a', '12138', NULL, 'MMG COLLEGE OF GENERAL SANTOS CITY, INC.', 'Private', '6345f5e4-54cf-496c-9a9f-c0ef8afce3ab', NULL, 'active', '2026-03-23 02:17:44', '2026-03-23 02:17:44'),
('a51b2ab3-19cb-4a6e-ab08-657ac72c800c', '12129', NULL, 'STI COLLEGE KORONADAL CITY, INC. TACURONG BRANCH', 'Private', '6345f5e4-54cf-496c-9a9f-c0ef8afce3ab', NULL, 'active', '2026-03-23 02:17:44', '2026-03-23 02:17:44'),
('a6b093e6-c5a2-4e2f-8ad6-5b4e34ff0870', '12051', NULL, 'NOTRE DAME OF SALAMAN COLLEGE', 'Private', '6345f5e4-54cf-496c-9a9f-c0ef8afce3ab', NULL, 'active', '2026-03-23 02:17:44', '2026-03-23 02:17:44'),
('a8f36996-12c2-42ab-b696-0865023239b5', '12132', NULL, 'GENERAL SANTOS ACADEMY, INCORPORATED', 'Private', '6345f5e4-54cf-496c-9a9f-c0ef8afce3ab', NULL, 'active', '2026-03-23 02:17:44', '2026-03-23 02:17:44'),
('b03773d1-b818-464d-ad71-cae5649a319f', '15055', NULL, 'EASTERN KUTAWATO COLLEGE', 'Private', '28fbd0bf-3ac5-40ba-8148-a74ae4897ab2', NULL, 'active', '2026-03-23 02:17:44', '2026-03-23 02:17:44'),
('b0516063-4f85-4626-b8d7-6fa28c8dbe2b', '11106', NULL, 'SOUTH COTABATO STATE COLLEGE', 'SUC', '6345f5e4-54cf-496c-9a9f-c0ef8afce3ab', NULL, 'active', '2026-03-23 02:17:44', '2026-03-23 02:17:44'),
('b0518408-2511-42c2-b57c-570d3cdb928e', '12102', NULL, 'SENATOR NINOY AQUINO COLLEGE FOUNDATION-MARAWI', 'Private', '28fbd0bf-3ac5-40ba-8148-a74ae4897ab2', NULL, 'active', '2026-03-23 02:17:44', '2026-03-23 02:17:44'),
('b0f3f505-2c20-42f4-91f9-28746e86b3ed', '15032', NULL, 'PHILIPPINE MUSLIM TEACHERS\' COLLEGE', 'Private', '28fbd0bf-3ac5-40ba-8148-a74ae4897ab2', NULL, 'active', '2026-03-23 02:17:44', '2026-03-23 02:17:44'),
('b3254c71-7a0c-4842-9154-418c8f518e13', '12012', NULL, 'DR. DOMINGO B. TAMONDONG MEMORIAL HOSPITAL & COLLEGE FOUNDATION, INC.', 'Private', '6345f5e4-54cf-496c-9a9f-c0ef8afce3ab', NULL, 'active', '2026-03-23 02:17:44', '2026-03-23 02:17:44'),
('b51a9bc1-3b60-4abf-ad87-6993ab70d086', '11081', NULL, 'SANTA CRUZ MISSION SCHOOL, INC.', 'Private', '6345f5e4-54cf-496c-9a9f-c0ef8afce3ab', NULL, 'active', '2026-03-23 02:17:44', '2026-03-23 02:17:44'),
('b77d4546-9dea-4253-941f-634cf01e4c76', '12121', NULL, 'KORBEL FOUNDATION COLLEGE, INC.', 'Private', '6345f5e4-54cf-496c-9a9f-c0ef8afce3ab', NULL, 'active', '2026-03-23 02:17:44', '2026-03-23 02:17:44'),
('b8e2e22b-f662-48ba-9794-9d9aba1e17da', '12049', NULL, 'NOTRE DAME OF KIDAPAWAN COLLEGE', 'Private', '6345f5e4-54cf-496c-9a9f-c0ef8afce3ab', NULL, 'active', '2026-03-23 02:17:44', '2026-03-23 02:17:44'),
('b9345d09-cae7-452b-ac93-81e1b54e8dc3', '12034', NULL, 'MAPANDI MEMORIAL COLLEGE', 'Private', '28fbd0bf-3ac5-40ba-8148-a74ae4897ab2', NULL, 'active', '2026-03-23 02:17:44', '2026-03-23 02:17:44'),
('bae139ab-a13e-481a-b109-f7a1415eec71', '15047', NULL, 'LANAO ISLAMIC PARAMEDICAL COLLEGE FOUNDATION', 'Private', '28fbd0bf-3ac5-40ba-8148-a74ae4897ab2', NULL, 'active', '2026-03-23 02:17:44', '2026-03-23 02:17:44'),
('c19261ac-af83-4381-98dc-6481813da1c2', '12108', NULL, 'GENERAL SANTOS DOCTORS\' MEDICAL SCHOOL FOUNDATION, INC.', 'Private', '6345f5e4-54cf-496c-9a9f-c0ef8afce3ab', NULL, 'active', '2026-03-23 02:17:44', '2026-03-23 02:17:44'),
('c1abb019-a431-4558-bd4d-8c28abe585ab', '12093', NULL, 'CENTRAL MINDANAO COMPUTER SCHOOL., INC.', 'Private', '6345f5e4-54cf-496c-9a9f-c0ef8afce3ab', NULL, 'active', '2026-03-23 02:17:44', '2026-03-23 02:17:44'),
('c28e1d42-edb4-4e7b-9e3b-2970ff16a8e2', '11052', NULL, 'NOTRE DAME OF MARBEL UNIVERSITY', 'Private', '6345f5e4-54cf-496c-9a9f-c0ef8afce3ab', NULL, 'active', '2026-03-23 02:17:44', '2026-03-23 02:17:44'),
('c4a4f0d0-453a-488f-a16c-82cd2f05d99e', '12087', NULL, 'MINDANAO ISLAMIC COMPUTER COLLEGE', 'Private', '28fbd0bf-3ac5-40ba-8148-a74ae4897ab2', NULL, 'active', '2026-03-23 02:17:44', '2026-03-23 02:17:44'),
('ceb92f47-2504-475f-9ab1-3de6057cf486', '12031', NULL, 'LEBAK FAMILY DOCTORS\' SCHOOL OF MIDWIFERY', 'Private', '6345f5e4-54cf-496c-9a9f-c0ef8afce3ab', NULL, 'active', '2026-03-23 02:17:44', '2026-03-23 02:17:44'),
('d072aaa5-a4bf-478d-9ace-901c516d521d', '12148', NULL, 'WEST CELEBES COLLEGE OF TECHNOLOGY INCORPORATED', 'Private', '6345f5e4-54cf-496c-9a9f-c0ef8afce3ab', NULL, 'active', '2026-03-23 02:17:44', '2026-03-23 02:17:44'),
('d0af136e-5102-42c7-87d4-749cc934f158', '15060', NULL, 'PHILIPPINE ENGINEERING AND AGRO-INDUSTRIAL COLLEGE', 'Private', '28fbd0bf-3ac5-40ba-8148-a74ae4897ab2', NULL, 'active', '2026-03-23 02:17:44', '2026-03-23 02:17:44'),
('d58fa05e-9f40-4e9f-a963-640a75fc1213', '11112', NULL, 'STI COLLEGE - GEN. SANTOS , INC', 'Private', '6345f5e4-54cf-496c-9a9f-c0ef8afce3ab', NULL, 'active', '2026-03-23 02:17:44', '2026-03-23 02:17:44'),
('d89546d8-5f50-4746-9134-bdc7c1b035eb', '12149', NULL, 'SOUTH CENTRAL MINDANAO COLLEGE OF SCIENCE AND TECHNOLOGY, INC.', 'Private', '6345f5e4-54cf-496c-9a9f-c0ef8afce3ab', NULL, 'active', '2026-03-23 02:17:44', '2026-03-23 02:17:44'),
('dc95b1a3-a0c7-4ce4-819d-607b39d45340', '15041', NULL, 'SAFRULLAH M. DIPATUAN FOUNDATION ACADEMY', 'Private', '28fbd0bf-3ac5-40ba-8148-a74ae4897ab2', NULL, 'active', '2026-03-23 02:17:44', '2026-03-23 02:17:44'),
('dec72e3d-3b5d-4464-9aa8-763075a6a126', '12068', NULL, 'SOUTHERN MINDANAO INSTITUTE OF TECHNOLOGY, INC.', 'Private', '6345f5e4-54cf-496c-9a9f-c0ef8afce3ab', NULL, 'active', '2026-03-23 02:17:44', '2026-03-23 02:17:44'),
('e0af2bdd-27f2-4e48-81f5-5e95c98912d1', '12147', NULL, 'MAKILALA INSTITUTE OF SCIENCE AND TECHNOLOGY', 'LUC', '6345f5e4-54cf-496c-9a9f-c0ef8afce3ab', NULL, 'active', '2026-03-23 02:17:44', '2026-03-23 02:17:44'),
('e21433ac-0d90-4a81-91ef-16b5d6d0ed39', '12155', NULL, 'SOUTHERN PHILIPPINE TECHNICAL COLLEGE OF KORONADAL, INCORPORATED', 'Private', '6345f5e4-54cf-496c-9a9f-c0ef8afce3ab', NULL, 'active', '2026-03-23 02:17:44', '2026-03-23 02:17:44'),
('e2ed5c03-c463-487a-b30a-54f3094af99e', '12008d', NULL, 'COTABATO FOUNDATION COLLEGE OF SCIENCE AND TECHNOLOGY - PIKIT', 'SUC', '6345f5e4-54cf-496c-9a9f-c0ef8afce3ab', NULL, 'active', '2026-03-23 02:17:44', '2026-03-23 02:17:44'),
('e52ec655-e539-402e-a858-f386a00e4332', '12052', NULL, 'NOTRE DAME OF TACURONG COLLEGE', 'Private', '6345f5e4-54cf-496c-9a9f-c0ef8afce3ab', NULL, 'active', '2026-03-23 02:17:44', '2026-03-23 02:17:44'),
('e53d06df-1deb-4660-ab0a-63cce1a0f654', '12122', NULL, 'STI COLLEGE KORONADAL CITY, INC.', 'Private', '6345f5e4-54cf-496c-9a9f-c0ef8afce3ab', NULL, 'active', '2026-03-23 02:17:44', '2026-03-23 02:17:44'),
('e7fe6100-2a38-4d58-8ce2-e24f3397ad15', '15054', NULL, 'BAI MALGEN MAMA COLLEGE', 'Private', '28fbd0bf-3ac5-40ba-8148-a74ae4897ab2', NULL, 'active', '2026-03-23 02:17:44', '2026-03-23 02:17:44'),
('e98c5f85-c891-4fc2-84ac-763e50641c67', '15063', NULL, 'IRANUN FOUNDATION COLLEGE', 'Private', '28fbd0bf-3ac5-40ba-8148-a74ae4897ab2', NULL, 'active', '2026-03-23 02:17:44', '2026-03-23 02:17:44'),
('ee667e0a-07e0-4f8d-86e1-9cf753c9fbc9', '12160', NULL, 'NEW BRIGHTON SCHOOL OF THE PHILIPPINES, INC.', 'Private', '6345f5e4-54cf-496c-9a9f-c0ef8afce3ab', NULL, 'active', '2026-03-23 02:17:44', '2026-03-23 02:17:44'),
('ef37b596-f1b9-46c6-a53b-27c71f5804bb', '12131', NULL, 'RAMON MAGSAYSAY MEMORIAL COLLEGES-MARBEL, INC.', 'Private', '6345f5e4-54cf-496c-9a9f-c0ef8afce3ab', NULL, 'active', '2026-03-23 02:17:44', '2026-03-23 02:17:44'),
('f2e6f8d6-735a-41e3-aa63-0ad26a52bb3a', '12158', NULL, 'GOLDENSTATE COLLEGE OF MAASIM, INC.', 'Private', '6345f5e4-54cf-496c-9a9f-c0ef8afce3ab', NULL, 'active', '2026-03-23 02:17:44', '2026-03-23 02:17:44'),
('f34c2c65-5632-4e71-97dc-1dfdf07ae481', '11057', NULL, 'SCHOLA DE SAN JOSE, INC.', 'Private', '6345f5e4-54cf-496c-9a9f-c0ef8afce3ab', NULL, 'active', '2026-03-23 02:17:44', '2026-03-23 02:17:44'),
('f7309c0b-f017-48d8-9d74-a8f1d7b30770', '12074b', NULL, 'SULTAN KUDARAT STATE UNIVERSITY - LUTAYAN', 'SUC', '6345f5e4-54cf-496c-9a9f-c0ef8afce3ab', NULL, 'active', '2026-03-23 02:17:44', '2026-03-23 02:17:44'),
('f9fb7e5d-cb9f-405a-b828-627a1e34482c', '12159', NULL, 'GOLDENSTATE COLLEGE OF MALUNGON, INC.', 'Private', '6345f5e4-54cf-496c-9a9f-c0ef8afce3ab', NULL, 'active', '2026-03-23 02:17:44', '2026-03-23 02:17:44'),
('fbdd8efa-348a-4b0d-a69e-4acd850a4142', '12143', NULL, 'KULAMAN ACADEMY INC.', 'Private', '6345f5e4-54cf-496c-9a9f-c0ef8afce3ab', NULL, 'active', '2026-03-23 02:17:44', '2026-03-23 02:17:44'),
('fc07119e-cbb5-4485-93b4-bfc20129b1b9', '12112', NULL, 'BROKENSHIRE COLLEGE SOCCSKSARGEN, INC.', 'Private', '6345f5e4-54cf-496c-9a9f-c0ef8afce3ab', NULL, 'active', '2026-03-23 02:17:44', '2026-03-23 02:17:44'),
('fca4133d-a03a-4be0-8e4d-ce6980b4e59d', '11051', NULL, 'NOTRE DAME OF DADIANGAS UNIVERSITY', 'Private', '6345f5e4-54cf-496c-9a9f-c0ef8afce3ab', NULL, 'active', '2026-03-23 02:17:44', '2026-03-23 02:17:44'),
('fcdf1a5b-9843-4265-ae36-08bbe33688ec', '12067', NULL, 'SOUTHERN CHRISTIAN COLLEGE', 'Private', '6345f5e4-54cf-496c-9a9f-c0ef8afce3ab', NULL, 'active', '2026-03-23 02:17:44', '2026-03-23 02:17:44'),
('fd36521d-7196-4a92-b9c3-3d14e21188f4', '15036', NULL, 'SPA COLLEGE', 'Private', '28fbd0bf-3ac5-40ba-8148-a74ae4897ab2', NULL, 'active', '2026-03-23 02:17:44', '2026-03-23 02:17:44');

-- --------------------------------------------------------

--
-- Table structure for table `jobs`
--

CREATE TABLE IF NOT EXISTS `jobs` (
  `id` bigint(20) UNSIGNED NOT NULL AUTO_INCREMENT,
  `queue` varchar(255) NOT NULL,
  `payload` longtext NOT NULL,
  `attempts` tinyint(3) UNSIGNED NOT NULL,
  `reserved_at` int(10) UNSIGNED DEFAULT NULL,
  `available_at` int(10) UNSIGNED NOT NULL,
  `created_at` int(10) UNSIGNED NOT NULL,
  PRIMARY KEY (`id`),
  KEY `jobs_queue_index` (`queue`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

--
-- RELATIONSHIPS FOR TABLE `jobs`:
--

-- --------------------------------------------------------

--
-- Table structure for table `job_batches`
--

CREATE TABLE IF NOT EXISTS `job_batches` (
  `id` varchar(255) NOT NULL,
  `name` varchar(255) NOT NULL,
  `total_jobs` int(11) NOT NULL,
  `pending_jobs` int(11) NOT NULL,
  `failed_jobs` int(11) NOT NULL,
  `failed_job_ids` longtext NOT NULL,
  `options` mediumtext DEFAULT NULL,
  `cancelled_at` int(11) DEFAULT NULL,
  `created_at` int(11) NOT NULL,
  `finished_at` int(11) DEFAULT NULL,
  PRIMARY KEY (`id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

--
-- RELATIONSHIPS FOR TABLE `job_batches`:
--

-- --------------------------------------------------------

--
-- Table structure for table `liquidations`
--

CREATE TABLE IF NOT EXISTS `liquidations` (
  `id` char(36) NOT NULL,
  `control_no` varchar(255) NOT NULL,
  `hei_id` char(36) NOT NULL,
  `program_id` char(36) NOT NULL,
  `academic_year_id` char(36) DEFAULT NULL,
  `created_by` char(36) DEFAULT NULL,
  `semester_id` char(36) DEFAULT NULL,
  `batch_no` varchar(255) DEFAULT NULL,
  `amount_disbursed` decimal(15,2) NOT NULL DEFAULT 0.00,
  `document_status_id` char(36) DEFAULT NULL,
  `rc_note_status_id` char(36) DEFAULT NULL,
  `liquidation_status_id` char(36) DEFAULT NULL,
  `date_submitted` date DEFAULT NULL,
  `remarks` text DEFAULT NULL,
  `reviewed_by` char(36) DEFAULT NULL COMMENT 'Regional Coordinator',
  `reviewed_at` timestamp NULL DEFAULT NULL,
  `accountant_reviewed_by` char(36) DEFAULT NULL COMMENT 'Accountant',
  `accountant_reviewed_at` timestamp NULL DEFAULT NULL,
  `coa_endorsed_by` char(36) DEFAULT NULL COMMENT 'Who endorsed to COA',
  `coa_endorsed_at` timestamp NULL DEFAULT NULL,
  `created_at` timestamp NULL DEFAULT NULL,
  `updated_at` timestamp NULL DEFAULT NULL,
  `deleted_at` timestamp NULL DEFAULT NULL,
  PRIMARY KEY (`id`),
  UNIQUE KEY `liquidations_control_no_unique` (`control_no`),
  KEY `liquidations_program_id_foreign` (`program_id`),
  KEY `liquidations_reviewed_by_foreign` (`reviewed_by`),
  KEY `liquidations_accountant_reviewed_by_foreign` (`accountant_reviewed_by`),
  KEY `liquidations_coa_endorsed_by_foreign` (`coa_endorsed_by`),
  KEY `liquidations_hei_id_index` (`hei_id`),
  KEY `liquidations_created_by_index` (`created_by`),
  KEY `idx_liquidations_semester` (`semester_id`),
  KEY `idx_liquidations_doc_status` (`document_status_id`),
  KEY `idx_liquidations_hei_year` (`hei_id`),
  KEY `idx_liquidations_liq_status` (`liquidation_status_id`),
  KEY `liquidations_academic_year_id_foreign` (`academic_year_id`),
  KEY `liquidations_rc_note_status_id_foreign` (`rc_note_status_id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

--
-- RELATIONSHIPS FOR TABLE `liquidations`:
--   `academic_year_id`
--       `academic_years` -> `id`
--   `accountant_reviewed_by`
--       `users` -> `id`
--   `coa_endorsed_by`
--       `users` -> `id`
--   `created_by`
--       `users` -> `id`
--   `document_status_id`
--       `document_statuses` -> `id`
--   `hei_id`
--       `heis` -> `id`
--   `liquidation_status_id`
--       `liquidation_statuses` -> `id`
--   `program_id`
--       `programs` -> `id`
--   `rc_note_status_id`
--       `rc_note_statuses` -> `id`
--   `reviewed_by`
--       `users` -> `id`
--   `semester_id`
--       `semesters` -> `id`
--

-- --------------------------------------------------------

--
-- Table structure for table `liquidation_beneficiaries`
--

CREATE TABLE IF NOT EXISTS `liquidation_beneficiaries` (
  `id` char(36) NOT NULL,
  `liquidation_id` char(36) NOT NULL,
  `student_no` varchar(255) NOT NULL,
  `last_name` varchar(255) NOT NULL,
  `first_name` varchar(255) NOT NULL,
  `middle_name` varchar(255) DEFAULT NULL,
  `extension_name` varchar(255) DEFAULT NULL,
  `award_no` varchar(255) NOT NULL,
  `date_disbursed` date NOT NULL,
  `amount` decimal(15,2) NOT NULL,
  `remarks` text DEFAULT NULL,
  `created_at` timestamp NULL DEFAULT NULL,
  `updated_at` timestamp NULL DEFAULT NULL,
  PRIMARY KEY (`id`),
  KEY `liquidation_beneficiaries_liquidation_id_foreign` (`liquidation_id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

--
-- RELATIONSHIPS FOR TABLE `liquidation_beneficiaries`:
--   `liquidation_id`
--       `liquidations` -> `id`
--

-- --------------------------------------------------------

--
-- Table structure for table `liquidation_comments`
--

CREATE TABLE IF NOT EXISTS `liquidation_comments` (
  `id` char(36) NOT NULL,
  `liquidation_id` char(36) NOT NULL,
  `document_requirement_id` char(36) DEFAULT NULL,
  `user_id` char(36) NOT NULL,
  `parent_id` char(36) DEFAULT NULL,
  `body` text NOT NULL,
  `mentions` longtext CHARACTER SET utf8mb4 COLLATE utf8mb4_bin DEFAULT NULL CHECK (json_valid(`mentions`)),
  `attachments` longtext CHARACTER SET utf8mb4 COLLATE utf8mb4_bin DEFAULT NULL CHECK (json_valid(`attachments`)),
  `created_at` timestamp NULL DEFAULT NULL,
  `updated_at` timestamp NULL DEFAULT NULL,
  PRIMARY KEY (`id`),
  KEY `liquidation_comments_user_id_foreign` (`user_id`),
  KEY `liquidation_comments_liquidation_id_created_at_index` (`liquidation_id`,`created_at`),
  KEY `liquidation_comments_parent_id_index` (`parent_id`),
  KEY `liquidation_comments_document_requirement_id_index` (`document_requirement_id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

--
-- RELATIONSHIPS FOR TABLE `liquidation_comments`:
--   `document_requirement_id`
--       `document_requirements` -> `id`
--   `liquidation_id`
--       `liquidations` -> `id`
--   `parent_id`
--       `liquidation_comments` -> `id`
--   `user_id`
--       `users` -> `id`
--

-- --------------------------------------------------------

--
-- Table structure for table `liquidation_compliance`
--

CREATE TABLE IF NOT EXISTS `liquidation_compliance` (
  `id` char(36) NOT NULL,
  `liquidation_id` char(36) NOT NULL,
  `documents_required` text DEFAULT NULL,
  `compliance_status_id` char(36) DEFAULT NULL,
  `concerns_emailed_at` timestamp NULL DEFAULT NULL,
  `compliance_submitted_at` timestamp NULL DEFAULT NULL,
  `amount_with_complete_docs` decimal(15,2) DEFAULT NULL,
  `created_at` timestamp NULL DEFAULT NULL,
  `updated_at` timestamp NULL DEFAULT NULL,
  PRIMARY KEY (`id`),
  KEY `liquidation_compliance_liquidation_id_index` (`liquidation_id`),
  KEY `liquidation_compliance_compliance_status_id_index` (`compliance_status_id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

--
-- RELATIONSHIPS FOR TABLE `liquidation_compliance`:
--   `compliance_status_id`
--       `compliance_statuses` -> `id`
--   `liquidation_id`
--       `liquidations` -> `id`
--

-- --------------------------------------------------------

--
-- Table structure for table `liquidation_documents`
--

CREATE TABLE IF NOT EXISTS `liquidation_documents` (
  `id` char(36) NOT NULL,
  `liquidation_id` char(36) NOT NULL,
  `document_requirement_id` char(36) DEFAULT NULL,
  `document_type` varchar(255) NOT NULL COMMENT 'e.g., Receipt, Invoice, Certificate, etc.',
  `file_name` varchar(255) NOT NULL,
  `file_path` varchar(255) NOT NULL,
  `file_type` varchar(255) DEFAULT NULL COMMENT 'MIME type',
  `file_size` int(11) DEFAULT NULL COMMENT 'File size in bytes',
  `gdrive_link` varchar(255) DEFAULT NULL,
  `is_gdrive` tinyint(1) NOT NULL DEFAULT 0,
  `description` text DEFAULT NULL,
  `uploaded_by` char(36) NOT NULL,
  `created_at` timestamp NULL DEFAULT NULL,
  `updated_at` timestamp NULL DEFAULT NULL,
  PRIMARY KEY (`id`),
  UNIQUE KEY `liq_doc_requirement_unique` (`liquidation_id`,`document_requirement_id`),
  KEY `liquidation_documents_uploaded_by_foreign` (`uploaded_by`),
  KEY `liquidation_documents_document_requirement_id_foreign` (`document_requirement_id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

--
-- RELATIONSHIPS FOR TABLE `liquidation_documents`:
--   `document_requirement_id`
--       `document_requirements` -> `id`
--   `liquidation_id`
--       `liquidations` -> `id`
--   `uploaded_by`
--       `users` -> `id`
--

-- --------------------------------------------------------

--
-- Table structure for table `liquidation_financials`
--

CREATE TABLE IF NOT EXISTS `liquidation_financials` (
  `id` char(36) NOT NULL,
  `liquidation_id` char(36) NOT NULL,
  `date_fund_released` date DEFAULT NULL,
  `due_date` date DEFAULT NULL,
  `fund_source` varchar(100) DEFAULT NULL,
  `amount_received` decimal(15,2) NOT NULL DEFAULT 0.00,
  `amount_disbursed` decimal(15,2) NOT NULL DEFAULT 0.00,
  `amount_liquidated` decimal(15,2) NOT NULL DEFAULT 0.00,
  `amount_refunded` decimal(15,2) NOT NULL DEFAULT 0.00,
  `disbursement_date` date DEFAULT NULL,
  `number_of_grantees` int(11) DEFAULT NULL,
  `or_number` varchar(50) DEFAULT NULL,
  `purpose` text DEFAULT NULL,
  `created_at` timestamp NULL DEFAULT NULL,
  `updated_at` timestamp NULL DEFAULT NULL,
  PRIMARY KEY (`id`),
  UNIQUE KEY `liquidation_financials_liquidation_id_unique` (`liquidation_id`),
  KEY `liquidation_financials_date_fund_released_index` (`date_fund_released`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

--
-- RELATIONSHIPS FOR TABLE `liquidation_financials`:
--   `liquidation_id`
--       `liquidations` -> `id`
--

-- --------------------------------------------------------

--
-- Table structure for table `liquidation_reviews`
--

CREATE TABLE IF NOT EXISTS `liquidation_reviews` (
  `id` char(36) NOT NULL,
  `liquidation_id` char(36) NOT NULL,
  `review_type_id` char(36) NOT NULL,
  `performed_by` char(36) NOT NULL,
  `performed_by_name` varchar(255) NOT NULL,
  `remarks` text DEFAULT NULL,
  `documents_for_compliance` text DEFAULT NULL,
  `performed_at` timestamp NOT NULL DEFAULT current_timestamp() ON UPDATE current_timestamp(),
  `created_at` timestamp NULL DEFAULT NULL,
  `updated_at` timestamp NULL DEFAULT NULL,
  PRIMARY KEY (`id`),
  KEY `fk_lreviews_review_type` (`review_type_id`),
  KEY `liquidation_reviews_performed_by_foreign` (`performed_by`),
  KEY `liquidation_reviews_liquidation_id_review_type_id_index` (`liquidation_id`,`review_type_id`),
  KEY `liquidation_reviews_liquidation_id_performed_at_index` (`liquidation_id`,`performed_at`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

--
-- RELATIONSHIPS FOR TABLE `liquidation_reviews`:
--   `review_type_id`
--       `review_types` -> `id`
--   `liquidation_id`
--       `liquidations` -> `id`
--   `performed_by`
--       `users` -> `id`
--

-- --------------------------------------------------------

--
-- Table structure for table `liquidation_running_data`
--

CREATE TABLE IF NOT EXISTS `liquidation_running_data` (
  `id` char(36) NOT NULL,
  `liquidation_id` char(36) NOT NULL,
  `grantees_liquidated` int(11) DEFAULT NULL,
  `amount_complete_docs` decimal(15,2) DEFAULT NULL,
  `amount_refunded` decimal(15,2) DEFAULT NULL,
  `refund_or_no` varchar(100) DEFAULT NULL,
  `total_amount_liquidated` decimal(15,2) DEFAULT NULL,
  `transmittal_ref_no` varchar(255) DEFAULT NULL,
  `group_transmittal_ref_no` varchar(255) DEFAULT NULL,
  `sort_order` int(10) UNSIGNED NOT NULL DEFAULT 0,
  `created_at` timestamp NULL DEFAULT NULL,
  `updated_at` timestamp NULL DEFAULT NULL,
  PRIMARY KEY (`id`),
  KEY `liquidation_running_data_liquidation_id_index` (`liquidation_id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

--
-- RELATIONSHIPS FOR TABLE `liquidation_running_data`:
--   `liquidation_id`
--       `liquidations` -> `id`
--

-- --------------------------------------------------------

--
-- Table structure for table `liquidation_statuses`
--

CREATE TABLE IF NOT EXISTS `liquidation_statuses` (
  `id` char(36) NOT NULL,
  `code` varchar(30) NOT NULL,
  `name` varchar(80) NOT NULL,
  `description` varchar(255) DEFAULT NULL,
  `badge_color` varchar(20) NOT NULL DEFAULT 'gray',
  `sort_order` int(11) NOT NULL DEFAULT 0,
  `is_active` tinyint(1) NOT NULL DEFAULT 1,
  `created_at` timestamp NULL DEFAULT NULL,
  `updated_at` timestamp NULL DEFAULT NULL,
  PRIMARY KEY (`id`),
  UNIQUE KEY `liquidation_statuses_code_unique` (`code`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

--
-- RELATIONSHIPS FOR TABLE `liquidation_statuses`:
--

--
-- Dumping data for table `liquidation_statuses`
--

INSERT INTO `liquidation_statuses` (`id`, `code`, `name`, `description`, `badge_color`, `sort_order`, `is_active`, `created_at`, `updated_at`) VALUES
('25a41724-ca0e-477a-966d-94eb9e127918', 'UNLIQUIDATED', 'Unliquidated', NULL, 'red', 1, 1, '2026-03-23 02:17:41', '2026-03-23 02:17:41'),
('2abb0cc4-0243-406b-852c-c5b971665297', 'PARTIALLY_LIQUIDATED', 'Partially Liquidated', NULL, 'yellow', 2, 1, '2026-03-23 02:17:41', '2026-03-23 02:17:41'),
('5e5a42ac-59fb-4651-abf8-44bba633f318', 'FULLY_LIQUIDATED', 'Fully Liquidated', NULL, 'green', 3, 1, '2026-03-23 02:17:41', '2026-03-23 02:17:41'),
('f6061e5f-9b73-4d5b-a252-949aa0f41ec0', 'VOIDED', 'Voided', 'Record has been voided by an administrator', 'gray', 99, 1, '2026-03-23 02:17:43', '2026-03-23 02:17:43');

-- --------------------------------------------------------

--
-- Table structure for table `liquidation_tracking_entries`
--

CREATE TABLE IF NOT EXISTS `liquidation_tracking_entries` (
  `id` char(36) NOT NULL,
  `liquidation_id` char(36) NOT NULL,
  `document_status_id` char(36) DEFAULT NULL,
  `received_by` text DEFAULT NULL,
  `date_received` date DEFAULT NULL,
  `reviewed_by` text DEFAULT NULL,
  `date_reviewed` date DEFAULT NULL,
  `rc_note` varchar(255) DEFAULT NULL,
  `date_endorsement` date DEFAULT NULL,
  `liquidation_status_id` char(36) DEFAULT NULL,
  `created_at` timestamp NULL DEFAULT NULL,
  `updated_at` timestamp NULL DEFAULT NULL,
  PRIMARY KEY (`id`),
  KEY `liquidation_tracking_entries_liquidation_id_foreign` (`liquidation_id`),
  KEY `liquidation_tracking_entries_document_status_id_foreign` (`document_status_id`),
  KEY `liquidation_tracking_entries_liquidation_status_id_foreign` (`liquidation_status_id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

--
-- RELATIONSHIPS FOR TABLE `liquidation_tracking_entries`:
--   `document_status_id`
--       `document_statuses` -> `id`
--   `liquidation_id`
--       `liquidations` -> `id`
--   `liquidation_status_id`
--       `liquidation_statuses` -> `id`
--

-- --------------------------------------------------------

--
-- Table structure for table `liquidation_tracking_entry_locations`
--

CREATE TABLE IF NOT EXISTS `liquidation_tracking_entry_locations` (
  `tracking_entry_id` char(36) NOT NULL,
  `document_location_id` char(36) NOT NULL,
  `sort_order` int(11) NOT NULL DEFAULT 0,
  PRIMARY KEY (`tracking_entry_id`,`document_location_id`),
  KEY `fk_ltel_location` (`document_location_id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

--
-- RELATIONSHIPS FOR TABLE `liquidation_tracking_entry_locations`:
--   `tracking_entry_id`
--       `liquidation_tracking_entries` -> `id`
--   `document_location_id`
--       `document_locations` -> `id`
--

-- --------------------------------------------------------

--
-- Table structure for table `liquidation_transmittals`
--

CREATE TABLE IF NOT EXISTS `liquidation_transmittals` (
  `id` char(36) NOT NULL,
  `liquidation_id` char(36) NOT NULL,
  `transmittal_reference_no` varchar(255) NOT NULL,
  `receiver_name` varchar(255) DEFAULT NULL,
  `document_location_id` char(36) DEFAULT NULL,
  `number_of_folders` int(11) DEFAULT NULL,
  `folder_location_number` varchar(255) DEFAULT NULL,
  `group_transmittal` varchar(255) DEFAULT NULL,
  `other_file_location` text DEFAULT NULL,
  `endorsed_by` char(36) NOT NULL,
  `endorsed_at` timestamp NOT NULL DEFAULT current_timestamp() ON UPDATE current_timestamp(),
  `received_at` timestamp NULL DEFAULT NULL,
  `location_history` longtext CHARACTER SET utf8mb4 COLLATE utf8mb4_bin DEFAULT NULL CHECK (json_valid(`location_history`)),
  `created_at` timestamp NULL DEFAULT NULL,
  `updated_at` timestamp NULL DEFAULT NULL,
  PRIMARY KEY (`id`),
  UNIQUE KEY `liquidation_transmittals_transmittal_reference_no_unique` (`transmittal_reference_no`),
  KEY `liquidation_transmittals_endorsed_by_foreign` (`endorsed_by`),
  KEY `liquidation_transmittals_liquidation_id_index` (`liquidation_id`),
  KEY `fk_transmittals_location` (`document_location_id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

--
-- RELATIONSHIPS FOR TABLE `liquidation_transmittals`:
--   `document_location_id`
--       `document_locations` -> `id`
--   `endorsed_by`
--       `users` -> `id`
--   `liquidation_id`
--       `liquidations` -> `id`
--

-- --------------------------------------------------------

--
-- Table structure for table `migrations`
--

CREATE TABLE IF NOT EXISTS `migrations` (
  `id` int(10) UNSIGNED NOT NULL AUTO_INCREMENT,
  `migration` varchar(255) NOT NULL,
  `batch` int(11) NOT NULL,
  PRIMARY KEY (`id`)
) ENGINE=InnoDB AUTO_INCREMENT=45 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

--
-- RELATIONSHIPS FOR TABLE `migrations`:
--

--
-- Dumping data for table `migrations`
--

INSERT INTO `migrations` (`id`, `migration`, `batch`) VALUES
(1, '0001_01_01_000000_create_users_table', 1),
(2, '0001_01_01_000001_create_cache_table', 1),
(3, '0001_01_01_000002_create_jobs_table', 1),
(4, '2025_08_26_100418_add_two_factor_columns_to_users_table', 1),
(5, '2026_01_14_061110_create_roles_table', 1),
(6, '2026_01_14_061131_create_permissions_table', 1),
(7, '2026_01_14_061238_create_role_permission_table', 1),
(8, '2026_01_14_061259_add_role_id_to_users_table', 1),
(9, '2026_01_17_000001_create_regions_table', 1),
(10, '2026_01_18_000001_create_heis_table', 1),
(11, '2026_01_18_000002_create_programs_table', 1),
(12, '2026_01_19_025242_create_liquidations_table', 1),
(13, '2026_01_20_000003_create_liquidation_documents_table', 1),
(14, '2026_01_21_060608_add_hei_id_to_users_table', 1),
(15, '2026_01_21_075337_create_liquidation_beneficiaries_table', 1),
(16, '2026_01_28_001147_add_region_to_users_table', 1),
(17, '2026_01_29_032953_add_gdrive_link_to_liquidation_documents_table', 1),
(18, '2026_02_02_071819_update_region_field_in_users_table', 1),
(19, '2026_02_05_100000_normalize_liquidations_schema', 1),
(20, '2026_02_05_120000_optimize_liquidations_schema', 1),
(21, '2026_02_12_072602_create_liquidation_statuses_table', 1),
(22, '2026_02_18_081205_create_liquidation_tracking_entries_table', 1),
(23, '2026_02_18_081727_add_columns_to_liquidation_tracking_entries_table', 1),
(24, '2026_02_18_154616_create_document_locations_table', 1),
(25, '2026_02_19_001718_create_liquidation_running_data_table', 1),
(26, '2026_02_19_004423_add_total_amount_liquidated_to_running_data', 1),
(27, '2026_02_19_085749_add_avatar_to_users_table', 1),
(28, '2026_02_23_100000_create_document_requirements_table', 1),
(29, '2026_02_24_000000_create_activity_logs_table', 1),
(30, '2026_02_24_033318_add_upload_message_to_document_requirements_table', 1),
(31, '2026_02_24_050355_add_reference_image_to_document_requirements_table', 1),
(32, '2026_02_25_014226_create_notifications_table', 1),
(33, '2026_02_25_075004_create_academic_years_table', 1),
(34, '2026_03_10_000000_create_liquidation_comments_table', 1),
(35, '2026_03_10_100000_add_document_requirement_id_to_liquidation_comments', 1),
(36, '2026_03_10_200000_add_metadata_to_notifications_table', 1),
(37, '2026_03_10_300000_add_attachment_to_liquidation_comments', 1),
(38, '2026_03_10_400000_change_comment_attachments_to_json', 1),
(39, '2026_03_17_000000_create_academic_year_document_requirements_table', 1),
(40, '2026_03_17_100000_add_parent_id_to_programs_table', 1),
(41, '2026_03_17_200000_add_voided_status_to_liquidation_statuses', 1),
(42, '2026_03_19_030505_add_program_id_to_users_table', 1),
(43, '2026_03_19_042747_create_user_program_table', 1),
(44, '2026_03_23_000000_create_rc_note_statuses_table', 1);

-- --------------------------------------------------------

--
-- Table structure for table `notifications`
--

CREATE TABLE IF NOT EXISTS `notifications` (
  `id` char(36) NOT NULL,
  `user_id` char(36) NOT NULL,
  `actor_id` char(36) DEFAULT NULL,
  `actor_name` varchar(255) NOT NULL,
  `action` varchar(50) NOT NULL,
  `description` varchar(255) NOT NULL,
  `subject_type` varchar(255) DEFAULT NULL,
  `subject_id` char(36) DEFAULT NULL,
  `subject_label` varchar(255) DEFAULT NULL,
  `module` varchar(50) DEFAULT NULL,
  `metadata` longtext CHARACTER SET utf8mb4 COLLATE utf8mb4_bin DEFAULT NULL CHECK (json_valid(`metadata`)),
  `read_at` timestamp NULL DEFAULT NULL,
  `created_at` timestamp NULL DEFAULT NULL,
  `updated_at` timestamp NULL DEFAULT NULL,
  PRIMARY KEY (`id`),
  KEY `notifications_actor_id_foreign` (`actor_id`),
  KEY `notifications_user_id_index` (`user_id`),
  KEY `notifications_user_id_read_at_index` (`user_id`,`read_at`),
  KEY `notifications_created_at_index` (`created_at`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

--
-- RELATIONSHIPS FOR TABLE `notifications`:
--   `actor_id`
--       `users` -> `id`
--   `user_id`
--       `users` -> `id`
--

-- --------------------------------------------------------

--
-- Table structure for table `password_reset_tokens`
--

CREATE TABLE IF NOT EXISTS `password_reset_tokens` (
  `email` varchar(255) NOT NULL,
  `token` varchar(255) NOT NULL,
  `created_at` timestamp NULL DEFAULT NULL,
  PRIMARY KEY (`email`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

--
-- RELATIONSHIPS FOR TABLE `password_reset_tokens`:
--

-- --------------------------------------------------------

--
-- Table structure for table `permissions`
--

CREATE TABLE IF NOT EXISTS `permissions` (
  `id` char(36) NOT NULL,
  `name` varchar(255) NOT NULL,
  `module` varchar(255) NOT NULL,
  `description` text DEFAULT NULL,
  `created_at` timestamp NULL DEFAULT NULL,
  `updated_at` timestamp NULL DEFAULT NULL,
  PRIMARY KEY (`id`),
  UNIQUE KEY `permissions_name_unique` (`name`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

--
-- RELATIONSHIPS FOR TABLE `permissions`:
--

--
-- Dumping data for table `permissions`
--

INSERT INTO `permissions` (`id`, `name`, `module`, `description`, `created_at`, `updated_at`) VALUES
('02ec57db-5a9c-47aa-a16a-3911dedbd017', 'view_dashboard', 'Reports', 'View dashboard statistics', '2026-03-23 02:17:44', '2026-03-23 02:17:44'),
('0557a6b5-6431-4a71-bbbd-ebfd610be4ac', 'delete_liquidation', 'Liquidation', 'Delete liquidation records', '2026-03-23 02:17:44', '2026-03-23 02:17:44'),
('107ed7f0-f43a-4e6f-a0f9-26fbcb63b521', 'delete_document_requirements', 'Document Requirements', 'Delete document requirements', '2026-03-23 02:17:44', '2026-03-23 02:17:44'),
('12f42597-ffda-4931-9de5-346cfcae8077', 'delete_semesters', 'Semesters', 'Delete semesters', '2026-03-23 02:17:44', '2026-03-23 02:17:44'),
('149c5a74-37e0-4d91-9d43-8d0816543a4f', 'view_hei', 'HEI', 'View HEI list', '2026-03-23 02:17:44', '2026-03-23 02:17:44'),
('2018d434-de21-446e-9fd0-fee935a3182a', 'view_document_requirements', 'Document Requirements', 'View document requirements list', '2026-03-23 02:17:44', '2026-03-23 02:17:44'),
('27d9585f-253f-4fa9-bd42-0c8f96e857c7', 'delete_programs', 'Programs', 'Delete programs', '2026-03-23 02:17:44', '2026-03-23 02:17:44'),
('29ea7ec1-cf7d-4b85-8e6d-ba03ef1f49d4', 'view_summary_ay', 'Reports', 'View summary per academic year', '2026-03-23 02:17:44', '2026-03-23 02:17:44'),
('2ec4efe1-bbec-442a-851c-5cf62c847603', 'edit_academic_years', 'Academic Years', 'Edit existing academic years', '2026-03-23 02:17:44', '2026-03-23 02:17:44'),
('2f0af5b0-1f4f-43a2-98b3-2df66ae0e187', 'create_academic_years', 'Academic Years', 'Create new academic years', '2026-03-23 02:17:44', '2026-03-23 02:17:44'),
('331c8452-3fa6-4fe8-87e8-134a16978e48', 'create_semesters', 'Semesters', 'Create new semesters', '2026-03-23 02:17:44', '2026-03-23 02:17:44'),
('44545fde-89fc-4cd8-8264-3860c6cd0ba7', 'edit_liquidation', 'Liquidation', 'Edit liquidation records', '2026-03-23 02:17:44', '2026-03-23 02:17:44'),
('5199d222-24be-4285-b65d-511719a8fc6a', 'edit_hei', 'HEI', 'Edit existing HEI', '2026-03-23 02:17:44', '2026-03-23 02:17:44'),
('58f8c5bd-c40f-4ee9-b459-fce1eca6a636', 'delete_users', 'User Management', 'Delete users', '2026-03-23 02:17:44', '2026-03-23 02:17:44'),
('598b6e63-3cd2-45ef-9d3c-f4565fad456b', 'edit_regions', 'Regions', 'Edit existing regions', '2026-03-23 02:17:44', '2026-03-23 02:17:44'),
('664104d6-a9db-4110-962d-f0d59032cffa', 'view_regions', 'Regions', 'View regions list', '2026-03-23 02:17:44', '2026-03-23 02:17:44'),
('6b531141-27d8-4243-9af7-05674ebe111f', 'change_user_status', 'User Management', 'Activate/deactivate users', '2026-03-23 02:17:44', '2026-03-23 02:17:44'),
('8317c1fe-1285-43e4-8888-f16779ed88c8', 'edit_users', 'User Management', 'Edit existing users', '2026-03-23 02:17:44', '2026-03-23 02:17:44'),
('876c244e-e7ea-4fe3-84f5-e8fb351c88c8', 'view_liquidation', 'Liquidation', 'View liquidation records', '2026-03-23 02:17:44', '2026-03-23 02:17:44'),
('8c87b1d4-2c0b-4a99-be44-a6836fc3135f', 'edit_roles', 'Roles & Permissions', 'Edit existing roles', '2026-03-23 02:17:44', '2026-03-23 02:17:44'),
('9135e741-b021-437c-b5cc-655e30544197', 'create_roles', 'Roles & Permissions', 'Create new roles', '2026-03-23 02:17:44', '2026-03-23 02:17:44'),
('9b62b30d-b496-403f-ae7b-9385a4f68ae6', 'sync_hei_api', 'HEI', 'Sync HEI from API', '2026-03-23 02:17:44', '2026-03-23 02:17:44'),
('9b6bca14-fbf2-4f7d-b9dc-1a36a94626ff', 'endorse_liquidation', 'Liquidation', 'Endorse liquidation to accounting', '2026-03-23 02:17:44', '2026-03-23 02:17:44'),
('a2380915-4766-481d-ae99-f192afc39632', 'view_semesters', 'Semesters', 'View semesters list', '2026-03-23 02:17:44', '2026-03-23 02:17:44'),
('aa289f76-d98e-4089-bd49-80cd912a0af4', 'create_regions', 'Regions', 'Create new regions', '2026-03-23 02:17:44', '2026-03-23 02:17:44'),
('af1b4c21-0590-47a4-bc9f-53d874e05a34', 'create_hei', 'HEI', 'Create new HEI', '2026-03-23 02:17:44', '2026-03-23 02:17:44'),
('b073b501-2c5b-495d-8423-905013859e31', 'view_academic_years', 'Academic Years', 'View academic years list', '2026-03-23 02:17:44', '2026-03-23 02:17:44'),
('b0c64e5e-4715-4315-bcfc-fa4e543e07bd', 'view_roles', 'Roles & Permissions', 'View roles list', '2026-03-23 02:17:44', '2026-03-23 02:17:44'),
('b3d25e22-ff58-407d-aba1-c3cdd2fbb9a5', 'review_liquidation', 'Liquidation', 'Review liquidation documents', '2026-03-23 02:17:44', '2026-03-23 02:17:44'),
('b9369c65-8abd-4916-8968-23f1dcca70bd', 'delete_roles', 'Roles & Permissions', 'Delete roles', '2026-03-23 02:17:44', '2026-03-23 02:17:44'),
('b9609c54-ad06-430f-8e87-1f1ca9b2004f', 'create_document_requirements', 'Document Requirements', 'Create new document requirements', '2026-03-23 02:17:44', '2026-03-23 02:17:44'),
('bbe24854-7cd1-413a-a533-89827e079d87', 'edit_programs', 'Programs', 'Edit existing programs', '2026-03-23 02:17:44', '2026-03-23 02:17:44'),
('c197cad3-9df5-4ebf-9a1a-751b51f6a752', 'view_reports', 'Reports', 'View reports', '2026-03-23 02:17:44', '2026-03-23 02:17:44'),
('c4ef8a50-7354-4a5d-b198-b5be9b523808', 'create_liquidation', 'Liquidation', 'Create liquidation records', '2026-03-23 02:17:44', '2026-03-23 02:17:44'),
('c908cb1c-884b-4d23-96b6-4a15014c957b', 'view_users', 'User Management', 'View users list', '2026-03-23 02:17:44', '2026-03-23 02:17:44'),
('cc07bb5e-301d-46dd-bc1a-72bb27411e83', 'export_reports', 'Reports', 'Export reports to Excel', '2026-03-23 02:17:44', '2026-03-23 02:17:44'),
('d5336040-1699-4f5f-92ae-2da0522713ae', 'edit_semesters', 'Semesters', 'Edit existing semesters', '2026-03-23 02:17:44', '2026-03-23 02:17:44'),
('d8921bfa-a844-4b52-9e27-bcc0453f28b3', 'delete_regions', 'Regions', 'Delete regions', '2026-03-23 02:17:44', '2026-03-23 02:17:44'),
('dc15c8d1-46cd-4f24-82a6-db2e366feb96', 'view_fund_source_filter', 'Reports', 'View fund source filter (UniFAST/STuFAPs) on dashboard', '2026-03-23 02:17:44', '2026-03-23 02:17:44'),
('de3c8598-8d18-4ac5-96ce-e45dfc4f8125', 'view_activity_logs', 'Activity Logs', 'View system activity logs', '2026-03-23 02:17:44', '2026-03-23 02:17:44'),
('df77846c-b8d2-4656-8df5-9fdf7a2df579', 'delete_hei', 'HEI', 'Delete HEI', '2026-03-23 02:17:44', '2026-03-23 02:17:44'),
('e332122d-7434-41d5-bf24-c87a0d28e0e7', 'edit_document_requirements', 'Document Requirements', 'Edit existing document requirements', '2026-03-23 02:17:44', '2026-03-23 02:17:44'),
('e71d05c4-d57c-4122-9dc2-f79f781a01ad', 'view_programs', 'Programs', 'View programs list', '2026-03-23 02:17:44', '2026-03-23 02:17:44'),
('ea13f163-f77e-4305-afbd-21149a2db8ab', 'delete_academic_years', 'Academic Years', 'Delete academic years', '2026-03-23 02:17:44', '2026-03-23 02:17:44'),
('eec05ad5-518e-4798-a7d8-d9967c86cdd5', 'view_summary_hei', 'Reports', 'View summary per HEI', '2026-03-23 02:17:44', '2026-03-23 02:17:44'),
('efa48d36-6d20-40f0-ba7e-b3d5b10ed51c', 'create_programs', 'Programs', 'Create new programs', '2026-03-23 02:17:44', '2026-03-23 02:17:44'),
('fb6245af-3199-4bc7-960f-bc1e4216058a', 'create_users', 'User Management', 'Create new users', '2026-03-23 02:17:44', '2026-03-23 02:17:44');

-- --------------------------------------------------------

--
-- Table structure for table `programs`
--

CREATE TABLE IF NOT EXISTS `programs` (
  `id` char(36) NOT NULL,
  `parent_id` char(36) DEFAULT NULL,
  `code` varchar(255) NOT NULL,
  `name` varchar(255) NOT NULL,
  `description` text DEFAULT NULL,
  `status` enum('active','inactive') NOT NULL DEFAULT 'active',
  `created_at` timestamp NULL DEFAULT NULL,
  `updated_at` timestamp NULL DEFAULT NULL,
  PRIMARY KEY (`id`),
  UNIQUE KEY `programs_code_unique` (`code`),
  KEY `programs_parent_id_index` (`parent_id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

--
-- RELATIONSHIPS FOR TABLE `programs`:
--   `parent_id`
--       `programs` -> `id`
--

--
-- Dumping data for table `programs`
--

INSERT INTO `programs` (`id`, `parent_id`, `code`, `name`, `description`, `status`, `created_at`, `updated_at`) VALUES
('49f6eb41-cd42-4359-b2b2-f0895af7c383', '770e9ade-3cf8-4e1b-9a45-1852c7292a0c', 'MSRS', 'MSRS', 'Medical Scholarship and Return Service', 'active', '2026-03-23 18:32:32', '2026-03-23 18:32:32'),
('53c5c334-0a20-4f3e-a1e2-3ec0cd178540', '770e9ade-3cf8-4e1b-9a45-1852c7292a0c', 'CMSP', 'CMSP', 'CHED Merit Scholarship Program', 'active', '2026-03-23 17:56:59', '2026-03-23 18:19:08'),
('770e9ade-3cf8-4e1b-9a45-1852c7292a0c', NULL, 'STUFAPS', 'Student Financial Assistance Programs', NULL, 'active', '2026-03-23 08:30:48', '2026-03-23 08:30:48'),
('a9c8ffd8-637d-4c50-85e4-778934730ccf', NULL, 'TES', 'Tertiary Education Subsidy', 'Financial assistance program for tertiary education students', 'active', '2026-03-23 02:17:44', '2026-03-23 02:17:44'),
('b92ec35b-6304-4e1b-a149-aa3330219fb4', '770e9ade-3cf8-4e1b-9a45-1852c7292a0c', 'SIDA-SGP', 'SIDA-SGP', 'Scholarship Grant for Children and Dependents of Sugarcane Industry Workers and Small Sugarcane Farmers', 'active', '2026-03-23 18:25:40', '2026-03-23 18:25:46'),
('c600e60e-9d72-48a6-9f50-710f468309fe', '770e9ade-3cf8-4e1b-9a45-1852c7292a0c', 'COSCHO', 'CoScho', 'Scholarship Program for Coconut Farmers and their Families', 'active', '2026-03-23 08:32:35', '2026-03-23 08:32:35'),
('d167bed7-fd80-4936-b014-6210584205ba', '770e9ade-3cf8-4e1b-9a45-1852c7292a0c', 'CHED-TDP', 'CHED TDP', 'CHED Tulong Dunong Program', 'active', '2026-03-23 18:18:52', '2026-03-23 18:18:52'),
('df19c886-3e3b-44c9-89ae-d682ec2982d2', '770e9ade-3cf8-4e1b-9a45-1852c7292a0c', 'ACEF-GIAHEP', 'ACEF-GIAHEP', 'Agricultural Competitiveness Enhancement Fund-Grants-in-Aid for Higher Education Program', 'active', '2026-03-23 18:22:35', '2026-03-23 18:22:35'),
('e54348a6-5f2e-4472-9d44-1d699c50bfb4', NULL, 'TDP', 'Tulong Dunong Program', 'Scholarship program for deserving students', 'active', '2026-03-23 02:17:44', '2026-03-23 02:17:44');

-- --------------------------------------------------------

--
-- Table structure for table `rc_note_statuses`
--

CREATE TABLE IF NOT EXISTS `rc_note_statuses` (
  `id` char(36) NOT NULL,
  `code` varchar(30) NOT NULL,
  `name` varchar(50) NOT NULL,
  `badge_color` varchar(20) NOT NULL DEFAULT 'gray',
  `sort_order` int(11) NOT NULL DEFAULT 0,
  `is_active` tinyint(1) NOT NULL DEFAULT 1,
  `created_at` timestamp NULL DEFAULT NULL,
  `updated_at` timestamp NULL DEFAULT NULL,
  PRIMARY KEY (`id`),
  UNIQUE KEY `rc_note_statuses_code_unique` (`code`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

--
-- RELATIONSHIPS FOR TABLE `rc_note_statuses`:
--

--
-- Dumping data for table `rc_note_statuses`
--

INSERT INTO `rc_note_statuses` (`id`, `code`, `name`, `badge_color`, `sort_order`, `is_active`, `created_at`, `updated_at`) VALUES
('43fc4bbd-946c-4432-897b-73c90db41122', 'FOR_ENDORSEMENT', 'For Endorsement', 'orange', 3, 1, '2026-03-23 02:17:45', '2026-03-23 02:17:45'),
('73019ebc-f05e-491a-84f2-86ab57890334', 'FOR_REVIEW', 'For Review', 'blue', 1, 1, '2026-03-23 02:17:45', '2026-03-23 02:17:45'),
('8addec4b-1dae-4576-8572-873dda360ffb', 'FOR_COMPLIANCE', 'For Compliance', 'yellow', 2, 1, '2026-03-23 02:17:45', '2026-03-23 02:17:45'),
('df457309-c14d-4cd2-b0f0-d140110b757c', 'FULLY_ENDORSED', 'Fully Endorsed', 'green', 4, 1, '2026-03-23 02:17:45', '2026-03-23 02:17:45'),
('efbea236-3844-4406-a4d4-483737695364', 'PARTIALLY_ENDORSED', 'Partially Endorsed', 'amber', 5, 1, '2026-03-23 02:17:45', '2026-03-23 02:17:45');

-- --------------------------------------------------------

--
-- Table structure for table `regions`
--

CREATE TABLE IF NOT EXISTS `regions` (
  `id` char(36) NOT NULL,
  `code` varchar(255) NOT NULL COMMENT 'Region Code (e.g., R12, BARMM)',
  `name` varchar(255) NOT NULL COMMENT 'Full Region Name',
  `description` varchar(255) DEFAULT NULL,
  `status` enum('active','inactive') NOT NULL DEFAULT 'active',
  `created_at` timestamp NULL DEFAULT NULL,
  `updated_at` timestamp NULL DEFAULT NULL,
  PRIMARY KEY (`id`),
  UNIQUE KEY `regions_code_unique` (`code`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

--
-- RELATIONSHIPS FOR TABLE `regions`:
--

--
-- Dumping data for table `regions`
--

INSERT INTO `regions` (`id`, `code`, `name`, `description`, `status`, `created_at`, `updated_at`) VALUES
('28fbd0bf-3ac5-40ba-8148-a74ae4897ab2', 'BARMM', 'BARMM', 'Bangsamoro Autonomous Region in Muslim Mindanao', 'active', '2026-03-23 02:17:44', '2026-03-23 02:17:44'),
('6345f5e4-54cf-496c-9a9f-c0ef8afce3ab', 'R12', 'Region 12', 'SOCCSKSARGEN Region', 'active', '2026-03-23 02:17:44', '2026-03-23 02:17:44');

-- --------------------------------------------------------

--
-- Table structure for table `review_types`
--

CREATE TABLE IF NOT EXISTS `review_types` (
  `id` char(36) NOT NULL,
  `code` varchar(50) NOT NULL,
  `name` varchar(100) NOT NULL,
  `description` varchar(255) DEFAULT NULL,
  `sort_order` int(10) UNSIGNED NOT NULL DEFAULT 0,
  `is_active` tinyint(1) NOT NULL DEFAULT 1,
  `created_at` timestamp NULL DEFAULT NULL,
  `updated_at` timestamp NULL DEFAULT NULL,
  PRIMARY KEY (`id`),
  UNIQUE KEY `review_types_code_unique` (`code`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

--
-- RELATIONSHIPS FOR TABLE `review_types`:
--

--
-- Dumping data for table `review_types`
--

INSERT INTO `review_types` (`id`, `code`, `name`, `description`, `sort_order`, `is_active`, `created_at`, `updated_at`) VALUES
('a6f6594d-ef96-4e3d-91e2-5fa22d4c9a5d', 'rc_endorsement', 'RC Endorsement', 'Regional Coordinator endorsed to Accounting', 2, 1, '2026-03-23 02:17:40', '2026-03-23 02:17:40'),
('b910d533-39d0-40f1-8099-2e4f4052baf5', 'accountant_return', 'Accountant Return', 'Accountant returned to Regional Coordinator', 4, 1, '2026-03-23 02:17:40', '2026-03-23 02:17:40'),
('bd977566-4851-47da-9ada-f379da73fb6d', 'rc_return', 'RC Return', 'Regional Coordinator returned to HEI', 1, 1, '2026-03-23 02:17:40', '2026-03-23 02:17:40'),
('c9723e3c-e5b6-4fc0-ae2d-e4c0c4ee43f0', 'hei_resubmission', 'HEI Resubmission', 'HEI resubmitted after RC return', 3, 1, '2026-03-23 02:17:40', '2026-03-23 02:17:40'),
('ea8e717b-015d-4bbd-b6bf-954e8d942c2b', 'accountant_endorsement', 'Accountant Endorsement', 'Accountant endorsed to COA', 5, 1, '2026-03-23 02:17:40', '2026-03-23 02:17:40');

-- --------------------------------------------------------

--
-- Table structure for table `roles`
--

CREATE TABLE IF NOT EXISTS `roles` (
  `id` char(36) NOT NULL,
  `name` varchar(255) NOT NULL,
  `description` text DEFAULT NULL,
  `created_at` timestamp NULL DEFAULT NULL,
  `updated_at` timestamp NULL DEFAULT NULL,
  PRIMARY KEY (`id`),
  UNIQUE KEY `roles_name_unique` (`name`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

--
-- RELATIONSHIPS FOR TABLE `roles`:
--

--
-- Dumping data for table `roles`
--

INSERT INTO `roles` (`id`, `name`, `description`, `created_at`, `updated_at`) VALUES
('17b42c97-b09a-4259-b688-02844106ef0f', 'STUFAPS Focal', 'Program-scoped focal for STUFAPS sub-programs', '2026-03-23 02:17:44', '2026-03-23 02:17:44'),
('7a29c53e-6a46-4e4d-869c-65ac65c25414', 'Regional Coordinator', 'Reviews and endorses liquidation', '2026-03-23 02:17:44', '2026-03-23 02:17:44'),
('88dc9f58-8d2e-4a4c-9ffc-f2e7efaf62c9', 'Super Admin', 'Has complete access to all system features', '2026-03-23 02:17:44', '2026-03-23 02:17:44'),
('8ffbe39b-9f26-498b-bc03-6ebb7ad0284a', 'Admin', 'System administrator', '2026-03-23 02:17:44', '2026-03-23 02:17:44'),
('90b84942-d8f2-4c50-9242-b0147252409d', 'Viewer', 'Read-only access', '2026-03-23 02:17:44', '2026-03-23 02:17:44'),
('dedd105d-6e90-4088-b921-3db61d87ea31', 'HEI', 'Higher Education Institution user', '2026-03-23 02:17:44', '2026-03-23 02:17:44'),
('e39b3033-d1ed-4e98-9258-846f048e0e60', 'Accountant', 'Reviews and endorses to COA', '2026-03-23 02:17:44', '2026-03-23 02:17:44'),
('f85b9444-aaeb-4ddf-9d26-625f1f8d80a4', 'Encoder', 'Data entry staff', '2026-03-23 02:17:44', '2026-03-23 02:17:44');

-- --------------------------------------------------------

--
-- Table structure for table `role_permission`
--

CREATE TABLE IF NOT EXISTS `role_permission` (
  `role_id` char(36) NOT NULL,
  `permission_id` char(36) NOT NULL,
  `created_at` timestamp NULL DEFAULT NULL,
  `updated_at` timestamp NULL DEFAULT NULL,
  PRIMARY KEY (`role_id`,`permission_id`),
  KEY `role_permission_permission_id_foreign` (`permission_id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

--
-- RELATIONSHIPS FOR TABLE `role_permission`:
--   `permission_id`
--       `permissions` -> `id`
--   `role_id`
--       `roles` -> `id`
--

--
-- Dumping data for table `role_permission`
--

INSERT INTO `role_permission` (`role_id`, `permission_id`, `created_at`, `updated_at`) VALUES
('17b42c97-b09a-4259-b688-02844106ef0f', '02ec57db-5a9c-47aa-a16a-3911dedbd017', '2026-03-23 02:17:44', '2026-03-23 02:17:44'),
('17b42c97-b09a-4259-b688-02844106ef0f', '149c5a74-37e0-4d91-9d43-8d0816543a4f', '2026-03-23 02:17:44', '2026-03-23 02:17:44'),
('17b42c97-b09a-4259-b688-02844106ef0f', '29ea7ec1-cf7d-4b85-8e6d-ba03ef1f49d4', '2026-03-23 02:17:44', '2026-03-23 02:17:44'),
('17b42c97-b09a-4259-b688-02844106ef0f', '44545fde-89fc-4cd8-8264-3860c6cd0ba7', '2026-03-23 02:17:44', '2026-03-23 02:17:44'),
('17b42c97-b09a-4259-b688-02844106ef0f', '876c244e-e7ea-4fe3-84f5-e8fb351c88c8', '2026-03-23 02:17:44', '2026-03-23 02:17:44'),
('17b42c97-b09a-4259-b688-02844106ef0f', '9b6bca14-fbf2-4f7d-b9dc-1a36a94626ff', '2026-03-23 02:17:44', '2026-03-23 02:17:44'),
('17b42c97-b09a-4259-b688-02844106ef0f', 'b3d25e22-ff58-407d-aba1-c3cdd2fbb9a5', '2026-03-23 02:17:44', '2026-03-23 02:17:44'),
('17b42c97-b09a-4259-b688-02844106ef0f', 'c197cad3-9df5-4ebf-9a1a-751b51f6a752', '2026-03-23 02:17:44', '2026-03-23 02:17:44'),
('17b42c97-b09a-4259-b688-02844106ef0f', 'c4ef8a50-7354-4a5d-b198-b5be9b523808', '2026-03-23 02:17:44', '2026-03-23 02:17:44'),
('17b42c97-b09a-4259-b688-02844106ef0f', 'eec05ad5-518e-4798-a7d8-d9967c86cdd5', '2026-03-23 02:17:44', '2026-03-23 02:17:44'),
('7a29c53e-6a46-4e4d-869c-65ac65c25414', '02ec57db-5a9c-47aa-a16a-3911dedbd017', '2026-03-23 02:17:44', '2026-03-23 02:17:44'),
('7a29c53e-6a46-4e4d-869c-65ac65c25414', '107ed7f0-f43a-4e6f-a0f9-26fbcb63b521', '2026-03-23 18:52:37', '2026-03-23 18:52:37'),
('7a29c53e-6a46-4e4d-869c-65ac65c25414', '149c5a74-37e0-4d91-9d43-8d0816543a4f', '2026-03-23 02:17:44', '2026-03-23 02:17:44'),
('7a29c53e-6a46-4e4d-869c-65ac65c25414', '2018d434-de21-446e-9fd0-fee935a3182a', '2026-03-23 18:52:37', '2026-03-23 18:52:37'),
('7a29c53e-6a46-4e4d-869c-65ac65c25414', '29ea7ec1-cf7d-4b85-8e6d-ba03ef1f49d4', '2026-03-23 02:17:44', '2026-03-23 02:17:44'),
('7a29c53e-6a46-4e4d-869c-65ac65c25414', '44545fde-89fc-4cd8-8264-3860c6cd0ba7', '2026-03-23 02:17:44', '2026-03-23 02:17:44'),
('7a29c53e-6a46-4e4d-869c-65ac65c25414', '876c244e-e7ea-4fe3-84f5-e8fb351c88c8', '2026-03-23 02:17:44', '2026-03-23 02:17:44'),
('7a29c53e-6a46-4e4d-869c-65ac65c25414', '9b6bca14-fbf2-4f7d-b9dc-1a36a94626ff', '2026-03-23 02:17:44', '2026-03-23 02:17:44'),
('7a29c53e-6a46-4e4d-869c-65ac65c25414', 'b3d25e22-ff58-407d-aba1-c3cdd2fbb9a5', '2026-03-23 02:17:44', '2026-03-23 02:17:44'),
('7a29c53e-6a46-4e4d-869c-65ac65c25414', 'b9609c54-ad06-430f-8e87-1f1ca9b2004f', '2026-03-23 18:52:37', '2026-03-23 18:52:37'),
('7a29c53e-6a46-4e4d-869c-65ac65c25414', 'c197cad3-9df5-4ebf-9a1a-751b51f6a752', '2026-03-23 02:17:44', '2026-03-23 02:17:44'),
('7a29c53e-6a46-4e4d-869c-65ac65c25414', 'c4ef8a50-7354-4a5d-b198-b5be9b523808', '2026-03-23 02:17:44', '2026-03-23 02:17:44'),
('7a29c53e-6a46-4e4d-869c-65ac65c25414', 'e332122d-7434-41d5-bf24-c87a0d28e0e7', '2026-03-23 18:52:37', '2026-03-23 18:52:37'),
('7a29c53e-6a46-4e4d-869c-65ac65c25414', 'eec05ad5-518e-4798-a7d8-d9967c86cdd5', '2026-03-23 02:17:44', '2026-03-23 02:17:44'),
('88dc9f58-8d2e-4a4c-9ffc-f2e7efaf62c9', '02ec57db-5a9c-47aa-a16a-3911dedbd017', '2026-03-23 02:17:44', '2026-03-23 02:17:44'),
('88dc9f58-8d2e-4a4c-9ffc-f2e7efaf62c9', '0557a6b5-6431-4a71-bbbd-ebfd610be4ac', '2026-03-23 02:17:44', '2026-03-23 02:17:44'),
('88dc9f58-8d2e-4a4c-9ffc-f2e7efaf62c9', '107ed7f0-f43a-4e6f-a0f9-26fbcb63b521', '2026-03-23 02:17:44', '2026-03-23 02:17:44'),
('88dc9f58-8d2e-4a4c-9ffc-f2e7efaf62c9', '12f42597-ffda-4931-9de5-346cfcae8077', '2026-03-23 02:17:44', '2026-03-23 02:17:44'),
('88dc9f58-8d2e-4a4c-9ffc-f2e7efaf62c9', '149c5a74-37e0-4d91-9d43-8d0816543a4f', '2026-03-23 02:17:44', '2026-03-23 02:17:44'),
('88dc9f58-8d2e-4a4c-9ffc-f2e7efaf62c9', '2018d434-de21-446e-9fd0-fee935a3182a', '2026-03-23 02:17:44', '2026-03-23 02:17:44'),
('88dc9f58-8d2e-4a4c-9ffc-f2e7efaf62c9', '27d9585f-253f-4fa9-bd42-0c8f96e857c7', '2026-03-23 02:17:44', '2026-03-23 02:17:44'),
('88dc9f58-8d2e-4a4c-9ffc-f2e7efaf62c9', '29ea7ec1-cf7d-4b85-8e6d-ba03ef1f49d4', '2026-03-23 02:17:44', '2026-03-23 02:17:44'),
('88dc9f58-8d2e-4a4c-9ffc-f2e7efaf62c9', '2ec4efe1-bbec-442a-851c-5cf62c847603', '2026-03-23 02:17:44', '2026-03-23 02:17:44'),
('88dc9f58-8d2e-4a4c-9ffc-f2e7efaf62c9', '2f0af5b0-1f4f-43a2-98b3-2df66ae0e187', '2026-03-23 02:17:44', '2026-03-23 02:17:44'),
('88dc9f58-8d2e-4a4c-9ffc-f2e7efaf62c9', '331c8452-3fa6-4fe8-87e8-134a16978e48', '2026-03-23 02:17:44', '2026-03-23 02:17:44'),
('88dc9f58-8d2e-4a4c-9ffc-f2e7efaf62c9', '44545fde-89fc-4cd8-8264-3860c6cd0ba7', '2026-03-23 02:17:44', '2026-03-23 02:17:44'),
('88dc9f58-8d2e-4a4c-9ffc-f2e7efaf62c9', '5199d222-24be-4285-b65d-511719a8fc6a', '2026-03-23 02:17:44', '2026-03-23 02:17:44'),
('88dc9f58-8d2e-4a4c-9ffc-f2e7efaf62c9', '58f8c5bd-c40f-4ee9-b459-fce1eca6a636', '2026-03-23 02:17:44', '2026-03-23 02:17:44'),
('88dc9f58-8d2e-4a4c-9ffc-f2e7efaf62c9', '598b6e63-3cd2-45ef-9d3c-f4565fad456b', '2026-03-23 02:17:44', '2026-03-23 02:17:44'),
('88dc9f58-8d2e-4a4c-9ffc-f2e7efaf62c9', '664104d6-a9db-4110-962d-f0d59032cffa', '2026-03-23 02:17:44', '2026-03-23 02:17:44'),
('88dc9f58-8d2e-4a4c-9ffc-f2e7efaf62c9', '6b531141-27d8-4243-9af7-05674ebe111f', '2026-03-23 02:17:44', '2026-03-23 02:17:44'),
('88dc9f58-8d2e-4a4c-9ffc-f2e7efaf62c9', '8317c1fe-1285-43e4-8888-f16779ed88c8', '2026-03-23 02:17:44', '2026-03-23 02:17:44'),
('88dc9f58-8d2e-4a4c-9ffc-f2e7efaf62c9', '876c244e-e7ea-4fe3-84f5-e8fb351c88c8', '2026-03-23 02:17:44', '2026-03-23 02:17:44'),
('88dc9f58-8d2e-4a4c-9ffc-f2e7efaf62c9', '8c87b1d4-2c0b-4a99-be44-a6836fc3135f', '2026-03-23 02:17:44', '2026-03-23 02:17:44'),
('88dc9f58-8d2e-4a4c-9ffc-f2e7efaf62c9', '9135e741-b021-437c-b5cc-655e30544197', '2026-03-23 02:17:44', '2026-03-23 02:17:44'),
('88dc9f58-8d2e-4a4c-9ffc-f2e7efaf62c9', '9b62b30d-b496-403f-ae7b-9385a4f68ae6', '2026-03-23 02:17:44', '2026-03-23 02:17:44'),
('88dc9f58-8d2e-4a4c-9ffc-f2e7efaf62c9', '9b6bca14-fbf2-4f7d-b9dc-1a36a94626ff', '2026-03-23 02:17:44', '2026-03-23 02:17:44'),
('88dc9f58-8d2e-4a4c-9ffc-f2e7efaf62c9', 'a2380915-4766-481d-ae99-f192afc39632', '2026-03-23 02:17:44', '2026-03-23 02:17:44'),
('88dc9f58-8d2e-4a4c-9ffc-f2e7efaf62c9', 'aa289f76-d98e-4089-bd49-80cd912a0af4', '2026-03-23 02:17:44', '2026-03-23 02:17:44'),
('88dc9f58-8d2e-4a4c-9ffc-f2e7efaf62c9', 'af1b4c21-0590-47a4-bc9f-53d874e05a34', '2026-03-23 02:17:44', '2026-03-23 02:17:44'),
('88dc9f58-8d2e-4a4c-9ffc-f2e7efaf62c9', 'b073b501-2c5b-495d-8423-905013859e31', '2026-03-23 02:17:44', '2026-03-23 02:17:44'),
('88dc9f58-8d2e-4a4c-9ffc-f2e7efaf62c9', 'b0c64e5e-4715-4315-bcfc-fa4e543e07bd', '2026-03-23 02:17:44', '2026-03-23 02:17:44'),
('88dc9f58-8d2e-4a4c-9ffc-f2e7efaf62c9', 'b3d25e22-ff58-407d-aba1-c3cdd2fbb9a5', '2026-03-23 02:17:44', '2026-03-23 02:17:44'),
('88dc9f58-8d2e-4a4c-9ffc-f2e7efaf62c9', 'b9369c65-8abd-4916-8968-23f1dcca70bd', '2026-03-23 02:17:44', '2026-03-23 02:17:44'),
('88dc9f58-8d2e-4a4c-9ffc-f2e7efaf62c9', 'b9609c54-ad06-430f-8e87-1f1ca9b2004f', '2026-03-23 02:17:44', '2026-03-23 02:17:44'),
('88dc9f58-8d2e-4a4c-9ffc-f2e7efaf62c9', 'bbe24854-7cd1-413a-a533-89827e079d87', '2026-03-23 02:17:44', '2026-03-23 02:17:44'),
('88dc9f58-8d2e-4a4c-9ffc-f2e7efaf62c9', 'c197cad3-9df5-4ebf-9a1a-751b51f6a752', '2026-03-23 02:17:44', '2026-03-23 02:17:44'),
('88dc9f58-8d2e-4a4c-9ffc-f2e7efaf62c9', 'c4ef8a50-7354-4a5d-b198-b5be9b523808', '2026-03-23 02:17:44', '2026-03-23 02:17:44'),
('88dc9f58-8d2e-4a4c-9ffc-f2e7efaf62c9', 'c908cb1c-884b-4d23-96b6-4a15014c957b', '2026-03-23 02:17:44', '2026-03-23 02:17:44'),
('88dc9f58-8d2e-4a4c-9ffc-f2e7efaf62c9', 'cc07bb5e-301d-46dd-bc1a-72bb27411e83', '2026-03-23 02:17:44', '2026-03-23 02:17:44'),
('88dc9f58-8d2e-4a4c-9ffc-f2e7efaf62c9', 'd5336040-1699-4f5f-92ae-2da0522713ae', '2026-03-23 02:17:44', '2026-03-23 02:17:44'),
('88dc9f58-8d2e-4a4c-9ffc-f2e7efaf62c9', 'd8921bfa-a844-4b52-9e27-bcc0453f28b3', '2026-03-23 02:17:44', '2026-03-23 02:17:44'),
('88dc9f58-8d2e-4a4c-9ffc-f2e7efaf62c9', 'dc15c8d1-46cd-4f24-82a6-db2e366feb96', '2026-03-23 02:17:44', '2026-03-23 02:17:44'),
('88dc9f58-8d2e-4a4c-9ffc-f2e7efaf62c9', 'de3c8598-8d18-4ac5-96ce-e45dfc4f8125', '2026-03-23 02:17:44', '2026-03-23 02:17:44'),
('88dc9f58-8d2e-4a4c-9ffc-f2e7efaf62c9', 'df77846c-b8d2-4656-8df5-9fdf7a2df579', '2026-03-23 02:17:44', '2026-03-23 02:17:44'),
('88dc9f58-8d2e-4a4c-9ffc-f2e7efaf62c9', 'e332122d-7434-41d5-bf24-c87a0d28e0e7', '2026-03-23 02:17:44', '2026-03-23 02:17:44'),
('88dc9f58-8d2e-4a4c-9ffc-f2e7efaf62c9', 'e71d05c4-d57c-4122-9dc2-f79f781a01ad', '2026-03-23 02:17:44', '2026-03-23 02:17:44'),
('88dc9f58-8d2e-4a4c-9ffc-f2e7efaf62c9', 'ea13f163-f77e-4305-afbd-21149a2db8ab', '2026-03-23 02:17:44', '2026-03-23 02:17:44'),
('88dc9f58-8d2e-4a4c-9ffc-f2e7efaf62c9', 'eec05ad5-518e-4798-a7d8-d9967c86cdd5', '2026-03-23 02:17:44', '2026-03-23 02:17:44'),
('88dc9f58-8d2e-4a4c-9ffc-f2e7efaf62c9', 'efa48d36-6d20-40f0-ba7e-b3d5b10ed51c', '2026-03-23 02:17:44', '2026-03-23 02:17:44'),
('88dc9f58-8d2e-4a4c-9ffc-f2e7efaf62c9', 'fb6245af-3199-4bc7-960f-bc1e4216058a', '2026-03-23 02:17:44', '2026-03-23 02:17:44'),
('8ffbe39b-9f26-498b-bc03-6ebb7ad0284a', '02ec57db-5a9c-47aa-a16a-3911dedbd017', '2026-03-23 02:17:44', '2026-03-23 02:17:44'),
('8ffbe39b-9f26-498b-bc03-6ebb7ad0284a', '0557a6b5-6431-4a71-bbbd-ebfd610be4ac', '2026-03-23 02:17:44', '2026-03-23 02:17:44'),
('8ffbe39b-9f26-498b-bc03-6ebb7ad0284a', '107ed7f0-f43a-4e6f-a0f9-26fbcb63b521', '2026-03-23 02:17:44', '2026-03-23 02:17:44'),
('8ffbe39b-9f26-498b-bc03-6ebb7ad0284a', '12f42597-ffda-4931-9de5-346cfcae8077', '2026-03-23 02:17:44', '2026-03-23 02:17:44'),
('8ffbe39b-9f26-498b-bc03-6ebb7ad0284a', '149c5a74-37e0-4d91-9d43-8d0816543a4f', '2026-03-23 02:17:44', '2026-03-23 02:17:44'),
('8ffbe39b-9f26-498b-bc03-6ebb7ad0284a', '2018d434-de21-446e-9fd0-fee935a3182a', '2026-03-23 02:17:44', '2026-03-23 02:17:44'),
('8ffbe39b-9f26-498b-bc03-6ebb7ad0284a', '27d9585f-253f-4fa9-bd42-0c8f96e857c7', '2026-03-23 02:17:44', '2026-03-23 02:17:44'),
('8ffbe39b-9f26-498b-bc03-6ebb7ad0284a', '29ea7ec1-cf7d-4b85-8e6d-ba03ef1f49d4', '2026-03-23 02:17:44', '2026-03-23 02:17:44'),
('8ffbe39b-9f26-498b-bc03-6ebb7ad0284a', '2ec4efe1-bbec-442a-851c-5cf62c847603', '2026-03-23 02:17:44', '2026-03-23 02:17:44'),
('8ffbe39b-9f26-498b-bc03-6ebb7ad0284a', '2f0af5b0-1f4f-43a2-98b3-2df66ae0e187', '2026-03-23 02:17:44', '2026-03-23 02:17:44'),
('8ffbe39b-9f26-498b-bc03-6ebb7ad0284a', '331c8452-3fa6-4fe8-87e8-134a16978e48', '2026-03-23 02:17:44', '2026-03-23 02:17:44'),
('8ffbe39b-9f26-498b-bc03-6ebb7ad0284a', '44545fde-89fc-4cd8-8264-3860c6cd0ba7', '2026-03-23 02:17:44', '2026-03-23 02:17:44'),
('8ffbe39b-9f26-498b-bc03-6ebb7ad0284a', '5199d222-24be-4285-b65d-511719a8fc6a', '2026-03-23 02:17:44', '2026-03-23 02:17:44'),
('8ffbe39b-9f26-498b-bc03-6ebb7ad0284a', '58f8c5bd-c40f-4ee9-b459-fce1eca6a636', '2026-03-23 02:17:44', '2026-03-23 02:17:44'),
('8ffbe39b-9f26-498b-bc03-6ebb7ad0284a', '598b6e63-3cd2-45ef-9d3c-f4565fad456b', '2026-03-23 02:17:44', '2026-03-23 02:17:44'),
('8ffbe39b-9f26-498b-bc03-6ebb7ad0284a', '664104d6-a9db-4110-962d-f0d59032cffa', '2026-03-23 02:17:44', '2026-03-23 02:17:44'),
('8ffbe39b-9f26-498b-bc03-6ebb7ad0284a', '6b531141-27d8-4243-9af7-05674ebe111f', '2026-03-23 02:17:44', '2026-03-23 02:17:44'),
('8ffbe39b-9f26-498b-bc03-6ebb7ad0284a', '8317c1fe-1285-43e4-8888-f16779ed88c8', '2026-03-23 02:17:44', '2026-03-23 02:17:44'),
('8ffbe39b-9f26-498b-bc03-6ebb7ad0284a', '876c244e-e7ea-4fe3-84f5-e8fb351c88c8', '2026-03-23 02:17:44', '2026-03-23 02:17:44'),
('8ffbe39b-9f26-498b-bc03-6ebb7ad0284a', '8c87b1d4-2c0b-4a99-be44-a6836fc3135f', '2026-03-23 02:17:44', '2026-03-23 02:17:44'),
('8ffbe39b-9f26-498b-bc03-6ebb7ad0284a', '9135e741-b021-437c-b5cc-655e30544197', '2026-03-23 02:17:44', '2026-03-23 02:17:44'),
('8ffbe39b-9f26-498b-bc03-6ebb7ad0284a', '9b62b30d-b496-403f-ae7b-9385a4f68ae6', '2026-03-23 02:17:44', '2026-03-23 02:17:44'),
('8ffbe39b-9f26-498b-bc03-6ebb7ad0284a', 'a2380915-4766-481d-ae99-f192afc39632', '2026-03-23 02:17:44', '2026-03-23 02:17:44'),
('8ffbe39b-9f26-498b-bc03-6ebb7ad0284a', 'aa289f76-d98e-4089-bd49-80cd912a0af4', '2026-03-23 02:17:44', '2026-03-23 02:17:44'),
('8ffbe39b-9f26-498b-bc03-6ebb7ad0284a', 'af1b4c21-0590-47a4-bc9f-53d874e05a34', '2026-03-23 02:17:44', '2026-03-23 02:17:44'),
('8ffbe39b-9f26-498b-bc03-6ebb7ad0284a', 'b073b501-2c5b-495d-8423-905013859e31', '2026-03-23 02:17:44', '2026-03-23 02:17:44'),
('8ffbe39b-9f26-498b-bc03-6ebb7ad0284a', 'b0c64e5e-4715-4315-bcfc-fa4e543e07bd', '2026-03-23 02:17:44', '2026-03-23 02:17:44'),
('8ffbe39b-9f26-498b-bc03-6ebb7ad0284a', 'b9369c65-8abd-4916-8968-23f1dcca70bd', '2026-03-23 02:17:44', '2026-03-23 02:17:44'),
('8ffbe39b-9f26-498b-bc03-6ebb7ad0284a', 'b9609c54-ad06-430f-8e87-1f1ca9b2004f', '2026-03-23 02:17:44', '2026-03-23 02:17:44'),
('8ffbe39b-9f26-498b-bc03-6ebb7ad0284a', 'bbe24854-7cd1-413a-a533-89827e079d87', '2026-03-23 02:17:44', '2026-03-23 02:17:44'),
('8ffbe39b-9f26-498b-bc03-6ebb7ad0284a', 'c197cad3-9df5-4ebf-9a1a-751b51f6a752', '2026-03-23 02:17:44', '2026-03-23 02:17:44'),
('8ffbe39b-9f26-498b-bc03-6ebb7ad0284a', 'c4ef8a50-7354-4a5d-b198-b5be9b523808', '2026-03-23 02:17:44', '2026-03-23 02:17:44'),
('8ffbe39b-9f26-498b-bc03-6ebb7ad0284a', 'c908cb1c-884b-4d23-96b6-4a15014c957b', '2026-03-23 02:17:44', '2026-03-23 02:17:44'),
('8ffbe39b-9f26-498b-bc03-6ebb7ad0284a', 'cc07bb5e-301d-46dd-bc1a-72bb27411e83', '2026-03-23 02:17:44', '2026-03-23 02:17:44'),
('8ffbe39b-9f26-498b-bc03-6ebb7ad0284a', 'd5336040-1699-4f5f-92ae-2da0522713ae', '2026-03-23 02:17:44', '2026-03-23 02:17:44'),
('8ffbe39b-9f26-498b-bc03-6ebb7ad0284a', 'd8921bfa-a844-4b52-9e27-bcc0453f28b3', '2026-03-23 02:17:44', '2026-03-23 02:17:44'),
('8ffbe39b-9f26-498b-bc03-6ebb7ad0284a', 'dc15c8d1-46cd-4f24-82a6-db2e366feb96', '2026-03-23 02:17:44', '2026-03-23 02:17:44'),
('8ffbe39b-9f26-498b-bc03-6ebb7ad0284a', 'de3c8598-8d18-4ac5-96ce-e45dfc4f8125', '2026-03-23 02:17:44', '2026-03-23 02:17:44'),
('8ffbe39b-9f26-498b-bc03-6ebb7ad0284a', 'df77846c-b8d2-4656-8df5-9fdf7a2df579', '2026-03-23 02:17:44', '2026-03-23 02:17:44'),
('8ffbe39b-9f26-498b-bc03-6ebb7ad0284a', 'e332122d-7434-41d5-bf24-c87a0d28e0e7', '2026-03-23 02:17:44', '2026-03-23 02:17:44'),
('8ffbe39b-9f26-498b-bc03-6ebb7ad0284a', 'e71d05c4-d57c-4122-9dc2-f79f781a01ad', '2026-03-23 02:17:44', '2026-03-23 02:17:44'),
('8ffbe39b-9f26-498b-bc03-6ebb7ad0284a', 'ea13f163-f77e-4305-afbd-21149a2db8ab', '2026-03-23 02:17:44', '2026-03-23 02:17:44'),
('8ffbe39b-9f26-498b-bc03-6ebb7ad0284a', 'eec05ad5-518e-4798-a7d8-d9967c86cdd5', '2026-03-23 02:17:44', '2026-03-23 02:17:44'),
('8ffbe39b-9f26-498b-bc03-6ebb7ad0284a', 'efa48d36-6d20-40f0-ba7e-b3d5b10ed51c', '2026-03-23 02:17:44', '2026-03-23 02:17:44'),
('8ffbe39b-9f26-498b-bc03-6ebb7ad0284a', 'fb6245af-3199-4bc7-960f-bc1e4216058a', '2026-03-23 02:17:44', '2026-03-23 02:17:44'),
('90b84942-d8f2-4c50-9242-b0147252409d', '02ec57db-5a9c-47aa-a16a-3911dedbd017', '2026-03-23 02:17:44', '2026-03-23 02:17:44'),
('90b84942-d8f2-4c50-9242-b0147252409d', '149c5a74-37e0-4d91-9d43-8d0816543a4f', '2026-03-23 02:17:44', '2026-03-23 02:17:44'),
('90b84942-d8f2-4c50-9242-b0147252409d', '29ea7ec1-cf7d-4b85-8e6d-ba03ef1f49d4', '2026-03-23 02:17:44', '2026-03-23 02:17:44'),
('90b84942-d8f2-4c50-9242-b0147252409d', '876c244e-e7ea-4fe3-84f5-e8fb351c88c8', '2026-03-23 02:17:44', '2026-03-23 02:17:44'),
('90b84942-d8f2-4c50-9242-b0147252409d', 'c197cad3-9df5-4ebf-9a1a-751b51f6a752', '2026-03-23 02:17:44', '2026-03-23 02:17:44'),
('90b84942-d8f2-4c50-9242-b0147252409d', 'eec05ad5-518e-4798-a7d8-d9967c86cdd5', '2026-03-23 02:17:44', '2026-03-23 02:17:44'),
('dedd105d-6e90-4088-b921-3db61d87ea31', '29ea7ec1-cf7d-4b85-8e6d-ba03ef1f49d4', '2026-03-23 02:17:44', '2026-03-23 02:17:44'),
('dedd105d-6e90-4088-b921-3db61d87ea31', '44545fde-89fc-4cd8-8264-3860c6cd0ba7', '2026-03-23 02:17:44', '2026-03-23 02:17:44'),
('dedd105d-6e90-4088-b921-3db61d87ea31', '876c244e-e7ea-4fe3-84f5-e8fb351c88c8', '2026-03-23 02:17:44', '2026-03-23 02:17:44'),
('dedd105d-6e90-4088-b921-3db61d87ea31', 'dc15c8d1-46cd-4f24-82a6-db2e366feb96', '2026-03-23 02:17:44', '2026-03-23 02:17:44'),
('e39b3033-d1ed-4e98-9258-846f048e0e60', '02ec57db-5a9c-47aa-a16a-3911dedbd017', '2026-03-23 02:17:44', '2026-03-23 02:17:44'),
('e39b3033-d1ed-4e98-9258-846f048e0e60', '149c5a74-37e0-4d91-9d43-8d0816543a4f', '2026-03-23 02:17:44', '2026-03-23 02:17:44'),
('e39b3033-d1ed-4e98-9258-846f048e0e60', '29ea7ec1-cf7d-4b85-8e6d-ba03ef1f49d4', '2026-03-23 02:17:44', '2026-03-23 02:17:44'),
('e39b3033-d1ed-4e98-9258-846f048e0e60', '876c244e-e7ea-4fe3-84f5-e8fb351c88c8', '2026-03-23 02:17:44', '2026-03-23 02:17:44'),
('e39b3033-d1ed-4e98-9258-846f048e0e60', '9b6bca14-fbf2-4f7d-b9dc-1a36a94626ff', '2026-03-23 02:17:44', '2026-03-23 02:17:44'),
('e39b3033-d1ed-4e98-9258-846f048e0e60', 'b3d25e22-ff58-407d-aba1-c3cdd2fbb9a5', '2026-03-23 02:17:44', '2026-03-23 02:17:44'),
('e39b3033-d1ed-4e98-9258-846f048e0e60', 'c197cad3-9df5-4ebf-9a1a-751b51f6a752', '2026-03-23 02:17:44', '2026-03-23 02:17:44'),
('e39b3033-d1ed-4e98-9258-846f048e0e60', 'dc15c8d1-46cd-4f24-82a6-db2e366feb96', '2026-03-23 02:17:44', '2026-03-23 02:17:44'),
('e39b3033-d1ed-4e98-9258-846f048e0e60', 'eec05ad5-518e-4798-a7d8-d9967c86cdd5', '2026-03-23 02:17:44', '2026-03-23 02:17:44'),
('f85b9444-aaeb-4ddf-9d26-625f1f8d80a4', '149c5a74-37e0-4d91-9d43-8d0816543a4f', '2026-03-23 02:17:44', '2026-03-23 02:17:44'),
('f85b9444-aaeb-4ddf-9d26-625f1f8d80a4', '44545fde-89fc-4cd8-8264-3860c6cd0ba7', '2026-03-23 02:17:44', '2026-03-23 02:17:44'),
('f85b9444-aaeb-4ddf-9d26-625f1f8d80a4', '5199d222-24be-4285-b65d-511719a8fc6a', '2026-03-23 02:17:44', '2026-03-23 02:17:44'),
('f85b9444-aaeb-4ddf-9d26-625f1f8d80a4', '876c244e-e7ea-4fe3-84f5-e8fb351c88c8', '2026-03-23 02:17:44', '2026-03-23 02:17:44'),
('f85b9444-aaeb-4ddf-9d26-625f1f8d80a4', 'af1b4c21-0590-47a4-bc9f-53d874e05a34', '2026-03-23 02:17:44', '2026-03-23 02:17:44'),
('f85b9444-aaeb-4ddf-9d26-625f1f8d80a4', 'c4ef8a50-7354-4a5d-b198-b5be9b523808', '2026-03-23 02:17:44', '2026-03-23 02:17:44');

-- --------------------------------------------------------

--
-- Table structure for table `semesters`
--

CREATE TABLE IF NOT EXISTS `semesters` (
  `id` char(36) NOT NULL,
  `code` varchar(20) NOT NULL,
  `name` varchar(50) NOT NULL,
  `sort_order` int(11) NOT NULL DEFAULT 0,
  `is_active` tinyint(1) NOT NULL DEFAULT 1,
  `created_at` timestamp NULL DEFAULT NULL,
  `updated_at` timestamp NULL DEFAULT NULL,
  PRIMARY KEY (`id`),
  UNIQUE KEY `semesters_code_unique` (`code`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

--
-- RELATIONSHIPS FOR TABLE `semesters`:
--

--
-- Dumping data for table `semesters`
--

INSERT INTO `semesters` (`id`, `code`, `name`, `sort_order`, `is_active`, `created_at`, `updated_at`) VALUES
('54bae5a3-897e-46db-aa2e-670048d138d2', 'SUM', 'Summer', 3, 1, '2026-03-23 02:17:41', '2026-03-23 02:17:41'),
('597bdb58-42e5-419f-b919-9047c3702c1e', '1ST', '1st Semester', 1, 1, '2026-03-23 02:17:41', '2026-03-23 02:17:41'),
('6d84ea84-fa69-43d2-aa89-24d341dfd91d', '2ND', '2nd Semester', 2, 1, '2026-03-23 02:17:41', '2026-03-23 02:17:41');

-- --------------------------------------------------------

--
-- Table structure for table `sessions`
--

CREATE TABLE IF NOT EXISTS `sessions` (
  `id` varchar(255) NOT NULL,
  `user_id` char(36) DEFAULT NULL,
  `ip_address` varchar(45) DEFAULT NULL,
  `user_agent` text DEFAULT NULL,
  `payload` longtext NOT NULL,
  `last_activity` int(11) NOT NULL,
  PRIMARY KEY (`id`),
  KEY `sessions_user_id_index` (`user_id`),
  KEY `sessions_last_activity_index` (`last_activity`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

--
-- RELATIONSHIPS FOR TABLE `sessions`:
--   `user_id`
--       `users` -> `id`
--

--
-- Dumping data for table `sessions`
--

INSERT INTO `sessions` (`id`, `user_id`, `ip_address`, `user_agent`, `payload`, `last_activity`) VALUES
('jLeVrLvMyGlLE4NY96yqP7MBmJj49LdWILmOuk3f', '3f99b231-2520-4c1b-939b-02022d36a06e', '127.0.0.1', 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/146.0.0.0 Safari/537.36', 'YTozOntzOjY6Il90b2tlbiI7czo0MDoiMU02a2w0Y2RHYVdjMmZHNXB3OFU2bXJxWWFid2VoVW9uZUxaM05JdiI7czo2OiJfZmxhc2giO2E6Mjp7czozOiJvbGQiO2E6MDp7fXM6MzoibmV3IjthOjA6e319czo1MDoibG9naW5fd2ViXzU5YmEzNmFkZGMyYjJmOTQwMTU4MGYwMTRjN2Y1OGVhNGUzMDk4OWQiO3M6MzY6IjNmOTliMjMxLTI1MjAtNGMxYi05MzliLTAyMDIyZDM2YTA2ZSI7fQ==', 1774320835);

-- --------------------------------------------------------

--
-- Table structure for table `users`
--

CREATE TABLE IF NOT EXISTS `users` (
  `id` char(36) NOT NULL,
  `name` varchar(255) NOT NULL,
  `email` varchar(255) NOT NULL,
  `avatar` varchar(255) DEFAULT NULL,
  `role_id` char(36) DEFAULT NULL,
  `hei_id` char(36) DEFAULT NULL,
  `region_id` char(36) DEFAULT NULL,
  `program_id` char(36) DEFAULT NULL,
  `status` enum('active','inactive') NOT NULL DEFAULT 'active',
  `email_verified_at` timestamp NULL DEFAULT NULL,
  `password` varchar(255) NOT NULL,
  `two_factor_secret` text DEFAULT NULL,
  `two_factor_recovery_codes` text DEFAULT NULL,
  `two_factor_confirmed_at` timestamp NULL DEFAULT NULL,
  `remember_token` varchar(100) DEFAULT NULL,
  `created_at` timestamp NULL DEFAULT NULL,
  `updated_at` timestamp NULL DEFAULT NULL,
  PRIMARY KEY (`id`),
  UNIQUE KEY `users_email_unique` (`email`),
  KEY `users_role_id_foreign` (`role_id`),
  KEY `users_hei_id_foreign` (`hei_id`),
  KEY `users_region_id_foreign` (`region_id`),
  KEY `users_program_id_index` (`program_id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

--
-- RELATIONSHIPS FOR TABLE `users`:
--   `hei_id`
--       `heis` -> `id`
--   `program_id`
--       `programs` -> `id`
--   `region_id`
--       `regions` -> `id`
--   `role_id`
--       `roles` -> `id`
--

--
-- Dumping data for table `users`
--

INSERT INTO `users` (`id`, `name`, `email`, `avatar`, `role_id`, `hei_id`, `region_id`, `program_id`, `status`, `email_verified_at`, `password`, `two_factor_secret`, `two_factor_recovery_codes`, `two_factor_confirmed_at`, `remember_token`, `created_at`, `updated_at`) VALUES
('3f99b231-2520-4c1b-939b-02022d36a06e', 'Root', 'root@gmail.com', NULL, '88dc9f58-8d2e-4a4c-9ffc-f2e7efaf62c9', NULL, NULL, NULL, 'active', NULL, '$2y$12$4l62T0YDWZjPBxDfBL/hluB20QfMO8ZbZ3JPgjG/K.LgpdQEw8.VS', NULL, NULL, NULL, NULL, '2026-03-23 02:18:38', '2026-03-23 02:18:38');

-- --------------------------------------------------------

--
-- Table structure for table `user_program`
--

CREATE TABLE IF NOT EXISTS `user_program` (
  `user_id` char(36) NOT NULL,
  `program_id` char(36) NOT NULL,
  `created_at` timestamp NULL DEFAULT NULL,
  `updated_at` timestamp NULL DEFAULT NULL,
  PRIMARY KEY (`user_id`,`program_id`),
  KEY `user_program_program_id_index` (`program_id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

--
-- RELATIONSHIPS FOR TABLE `user_program`:
--   `program_id`
--       `programs` -> `id`
--   `user_id`
--       `users` -> `id`
--

--
-- Constraints for dumped tables
--

--
-- Constraints for table `academic_year_document_requirements`
--
ALTER TABLE `academic_year_document_requirements`
  ADD CONSTRAINT `ay_req_ay_fk` FOREIGN KEY (`academic_year_id`) REFERENCES `academic_years` (`id`) ON DELETE CASCADE,
  ADD CONSTRAINT `ay_req_dr_fk` FOREIGN KEY (`document_requirement_id`) REFERENCES `document_requirements` (`id`) ON DELETE CASCADE;

--
-- Constraints for table `activity_logs`
--
ALTER TABLE `activity_logs`
  ADD CONSTRAINT `activity_logs_user_id_foreign` FOREIGN KEY (`user_id`) REFERENCES `users` (`id`) ON DELETE SET NULL;

--
-- Constraints for table `document_requirements`
--
ALTER TABLE `document_requirements`
  ADD CONSTRAINT `document_requirements_program_id_foreign` FOREIGN KEY (`program_id`) REFERENCES `programs` (`id`) ON DELETE CASCADE;

--
-- Constraints for table `heis`
--
ALTER TABLE `heis`
  ADD CONSTRAINT `heis_region_id_foreign` FOREIGN KEY (`region_id`) REFERENCES `regions` (`id`) ON DELETE SET NULL;

--
-- Constraints for table `liquidations`
--
ALTER TABLE `liquidations`
  ADD CONSTRAINT `liquidations_academic_year_id_foreign` FOREIGN KEY (`academic_year_id`) REFERENCES `academic_years` (`id`) ON DELETE SET NULL,
  ADD CONSTRAINT `liquidations_accountant_reviewed_by_foreign` FOREIGN KEY (`accountant_reviewed_by`) REFERENCES `users` (`id`) ON DELETE SET NULL,
  ADD CONSTRAINT `liquidations_coa_endorsed_by_foreign` FOREIGN KEY (`coa_endorsed_by`) REFERENCES `users` (`id`) ON DELETE SET NULL,
  ADD CONSTRAINT `liquidations_created_by_foreign` FOREIGN KEY (`created_by`) REFERENCES `users` (`id`) ON DELETE CASCADE,
  ADD CONSTRAINT `liquidations_document_status_id_foreign` FOREIGN KEY (`document_status_id`) REFERENCES `document_statuses` (`id`) ON DELETE SET NULL,
  ADD CONSTRAINT `liquidations_hei_id_foreign` FOREIGN KEY (`hei_id`) REFERENCES `heis` (`id`) ON DELETE CASCADE,
  ADD CONSTRAINT `liquidations_liquidation_status_id_foreign` FOREIGN KEY (`liquidation_status_id`) REFERENCES `liquidation_statuses` (`id`) ON DELETE SET NULL,
  ADD CONSTRAINT `liquidations_program_id_foreign` FOREIGN KEY (`program_id`) REFERENCES `programs` (`id`) ON DELETE CASCADE,
  ADD CONSTRAINT `liquidations_rc_note_status_id_foreign` FOREIGN KEY (`rc_note_status_id`) REFERENCES `rc_note_statuses` (`id`) ON DELETE SET NULL,
  ADD CONSTRAINT `liquidations_reviewed_by_foreign` FOREIGN KEY (`reviewed_by`) REFERENCES `users` (`id`) ON DELETE SET NULL,
  ADD CONSTRAINT `liquidations_semester_id_foreign` FOREIGN KEY (`semester_id`) REFERENCES `semesters` (`id`) ON DELETE SET NULL;

--
-- Constraints for table `liquidation_beneficiaries`
--
ALTER TABLE `liquidation_beneficiaries`
  ADD CONSTRAINT `liquidation_beneficiaries_liquidation_id_foreign` FOREIGN KEY (`liquidation_id`) REFERENCES `liquidations` (`id`) ON DELETE CASCADE;

--
-- Constraints for table `liquidation_comments`
--
ALTER TABLE `liquidation_comments`
  ADD CONSTRAINT `liquidation_comments_document_requirement_id_foreign` FOREIGN KEY (`document_requirement_id`) REFERENCES `document_requirements` (`id`) ON DELETE SET NULL,
  ADD CONSTRAINT `liquidation_comments_liquidation_id_foreign` FOREIGN KEY (`liquidation_id`) REFERENCES `liquidations` (`id`) ON DELETE CASCADE,
  ADD CONSTRAINT `liquidation_comments_parent_id_foreign` FOREIGN KEY (`parent_id`) REFERENCES `liquidation_comments` (`id`) ON DELETE SET NULL,
  ADD CONSTRAINT `liquidation_comments_user_id_foreign` FOREIGN KEY (`user_id`) REFERENCES `users` (`id`) ON DELETE CASCADE;

--
-- Constraints for table `liquidation_compliance`
--
ALTER TABLE `liquidation_compliance`
  ADD CONSTRAINT `fk_lcompliance_status` FOREIGN KEY (`compliance_status_id`) REFERENCES `compliance_statuses` (`id`) ON DELETE SET NULL,
  ADD CONSTRAINT `liquidation_compliance_liquidation_id_foreign` FOREIGN KEY (`liquidation_id`) REFERENCES `liquidations` (`id`) ON DELETE CASCADE;

--
-- Constraints for table `liquidation_documents`
--
ALTER TABLE `liquidation_documents`
  ADD CONSTRAINT `liquidation_documents_document_requirement_id_foreign` FOREIGN KEY (`document_requirement_id`) REFERENCES `document_requirements` (`id`) ON DELETE SET NULL,
  ADD CONSTRAINT `liquidation_documents_liquidation_id_foreign` FOREIGN KEY (`liquidation_id`) REFERENCES `liquidations` (`id`) ON DELETE CASCADE,
  ADD CONSTRAINT `liquidation_documents_uploaded_by_foreign` FOREIGN KEY (`uploaded_by`) REFERENCES `users` (`id`);

--
-- Constraints for table `liquidation_financials`
--
ALTER TABLE `liquidation_financials`
  ADD CONSTRAINT `liquidation_financials_liquidation_id_foreign` FOREIGN KEY (`liquidation_id`) REFERENCES `liquidations` (`id`) ON DELETE CASCADE;

--
-- Constraints for table `liquidation_reviews`
--
ALTER TABLE `liquidation_reviews`
  ADD CONSTRAINT `fk_lreviews_review_type` FOREIGN KEY (`review_type_id`) REFERENCES `review_types` (`id`),
  ADD CONSTRAINT `liquidation_reviews_liquidation_id_foreign` FOREIGN KEY (`liquidation_id`) REFERENCES `liquidations` (`id`) ON DELETE CASCADE,
  ADD CONSTRAINT `liquidation_reviews_performed_by_foreign` FOREIGN KEY (`performed_by`) REFERENCES `users` (`id`) ON DELETE CASCADE;

--
-- Constraints for table `liquidation_running_data`
--
ALTER TABLE `liquidation_running_data`
  ADD CONSTRAINT `liquidation_running_data_liquidation_id_foreign` FOREIGN KEY (`liquidation_id`) REFERENCES `liquidations` (`id`) ON DELETE CASCADE;

--
-- Constraints for table `liquidation_tracking_entries`
--
ALTER TABLE `liquidation_tracking_entries`
  ADD CONSTRAINT `liquidation_tracking_entries_document_status_id_foreign` FOREIGN KEY (`document_status_id`) REFERENCES `document_statuses` (`id`) ON DELETE SET NULL,
  ADD CONSTRAINT `liquidation_tracking_entries_liquidation_id_foreign` FOREIGN KEY (`liquidation_id`) REFERENCES `liquidations` (`id`) ON DELETE CASCADE,
  ADD CONSTRAINT `liquidation_tracking_entries_liquidation_status_id_foreign` FOREIGN KEY (`liquidation_status_id`) REFERENCES `liquidation_statuses` (`id`) ON DELETE SET NULL;

--
-- Constraints for table `liquidation_tracking_entry_locations`
--
ALTER TABLE `liquidation_tracking_entry_locations`
  ADD CONSTRAINT `fk_ltel_entry` FOREIGN KEY (`tracking_entry_id`) REFERENCES `liquidation_tracking_entries` (`id`) ON DELETE CASCADE,
  ADD CONSTRAINT `fk_ltel_location` FOREIGN KEY (`document_location_id`) REFERENCES `document_locations` (`id`) ON DELETE CASCADE;

--
-- Constraints for table `liquidation_transmittals`
--
ALTER TABLE `liquidation_transmittals`
  ADD CONSTRAINT `fk_transmittals_location` FOREIGN KEY (`document_location_id`) REFERENCES `document_locations` (`id`) ON DELETE SET NULL,
  ADD CONSTRAINT `liquidation_transmittals_endorsed_by_foreign` FOREIGN KEY (`endorsed_by`) REFERENCES `users` (`id`) ON DELETE CASCADE,
  ADD CONSTRAINT `liquidation_transmittals_liquidation_id_foreign` FOREIGN KEY (`liquidation_id`) REFERENCES `liquidations` (`id`) ON DELETE CASCADE;

--
-- Constraints for table `notifications`
--
ALTER TABLE `notifications`
  ADD CONSTRAINT `notifications_actor_id_foreign` FOREIGN KEY (`actor_id`) REFERENCES `users` (`id`) ON DELETE SET NULL,
  ADD CONSTRAINT `notifications_user_id_foreign` FOREIGN KEY (`user_id`) REFERENCES `users` (`id`) ON DELETE CASCADE;

--
-- Constraints for table `programs`
--
ALTER TABLE `programs`
  ADD CONSTRAINT `programs_parent_fk` FOREIGN KEY (`parent_id`) REFERENCES `programs` (`id`) ON DELETE SET NULL;

--
-- Constraints for table `role_permission`
--
ALTER TABLE `role_permission`
  ADD CONSTRAINT `role_permission_permission_id_foreign` FOREIGN KEY (`permission_id`) REFERENCES `permissions` (`id`) ON DELETE CASCADE,
  ADD CONSTRAINT `role_permission_role_id_foreign` FOREIGN KEY (`role_id`) REFERENCES `roles` (`id`) ON DELETE CASCADE;

--
-- Constraints for table `sessions`
--
ALTER TABLE `sessions`
  ADD CONSTRAINT `sessions_user_id_foreign` FOREIGN KEY (`user_id`) REFERENCES `users` (`id`) ON DELETE CASCADE;

--
-- Constraints for table `users`
--
ALTER TABLE `users`
  ADD CONSTRAINT `users_hei_id_foreign` FOREIGN KEY (`hei_id`) REFERENCES `heis` (`id`) ON DELETE SET NULL,
  ADD CONSTRAINT `users_program_id_foreign` FOREIGN KEY (`program_id`) REFERENCES `programs` (`id`) ON DELETE SET NULL,
  ADD CONSTRAINT `users_region_id_foreign` FOREIGN KEY (`region_id`) REFERENCES `regions` (`id`) ON DELETE SET NULL,
  ADD CONSTRAINT `users_role_id_foreign` FOREIGN KEY (`role_id`) REFERENCES `roles` (`id`) ON DELETE SET NULL;

--
-- Constraints for table `user_program`
--
ALTER TABLE `user_program`
  ADD CONSTRAINT `user_program_program_id_foreign` FOREIGN KEY (`program_id`) REFERENCES `programs` (`id`) ON DELETE CASCADE,
  ADD CONSTRAINT `user_program_user_id_foreign` FOREIGN KEY (`user_id`) REFERENCES `users` (`id`) ON DELETE CASCADE;
SET FOREIGN_KEY_CHECKS=1;
COMMIT;

/*!40101 SET CHARACTER_SET_CLIENT=@OLD_CHARACTER_SET_CLIENT */;
/*!40101 SET CHARACTER_SET_RESULTS=@OLD_CHARACTER_SET_RESULTS */;
/*!40101 SET COLLATION_CONNECTION=@OLD_COLLATION_CONNECTION */;
