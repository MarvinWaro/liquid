-- phpMyAdmin SQL Dump
-- version 5.2.1
-- https://www.phpmyadmin.net/
--
-- Host: 127.0.0.1
-- Generation Time: Jan 20, 2026 at 02:18 PM
-- Server version: 10.4.32-MariaDB
-- PHP Version: 8.2.12

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
-- Table structure for table `cache`
--

CREATE TABLE `cache` (
  `key` varchar(255) NOT NULL,
  `value` mediumtext NOT NULL,
  `expiration` int(11) NOT NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

--
-- Dumping data for table `cache`
--

INSERT INTO `cache` (`key`, `value`, `expiration`) VALUES
('laravel-cache-36f8dfad3a7128d2df88d4bfd3cd09c6', 'i:1;', 1768914974),
('laravel-cache-36f8dfad3a7128d2df88d4bfd3cd09c6:timer', 'i:1768914974;', 1768914974);

-- --------------------------------------------------------

--
-- Table structure for table `cache_locks`
--

CREATE TABLE `cache_locks` (
  `key` varchar(255) NOT NULL,
  `owner` varchar(255) NOT NULL,
  `expiration` int(11) NOT NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- --------------------------------------------------------

--
-- Table structure for table `failed_jobs`
--

CREATE TABLE `failed_jobs` (
  `id` bigint(20) UNSIGNED NOT NULL,
  `uuid` varchar(255) NOT NULL,
  `connection` text NOT NULL,
  `queue` text NOT NULL,
  `payload` longtext NOT NULL,
  `exception` longtext NOT NULL,
  `failed_at` timestamp NOT NULL DEFAULT current_timestamp()
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- --------------------------------------------------------

--
-- Table structure for table `heis`
--

CREATE TABLE `heis` (
  `id` bigint(20) UNSIGNED NOT NULL,
  `code` varchar(255) NOT NULL COMMENT 'HEI Code',
  `name` varchar(255) NOT NULL,
  `type` varchar(255) DEFAULT NULL COMMENT 'Public/Private',
  `region` varchar(255) DEFAULT NULL,
  `province` varchar(255) DEFAULT NULL,
  `city_municipality` varchar(255) DEFAULT NULL,
  `address` text DEFAULT NULL,
  `contact_person` varchar(255) DEFAULT NULL,
  `contact_number` varchar(255) DEFAULT NULL,
  `email` varchar(255) DEFAULT NULL,
  `status` enum('active','inactive') NOT NULL DEFAULT 'active',
  `created_at` timestamp NULL DEFAULT NULL,
  `updated_at` timestamp NULL DEFAULT NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- --------------------------------------------------------

--
-- Table structure for table `jobs`
--

CREATE TABLE `jobs` (
  `id` bigint(20) UNSIGNED NOT NULL,
  `queue` varchar(255) NOT NULL,
  `payload` longtext NOT NULL,
  `attempts` tinyint(3) UNSIGNED NOT NULL,
  `reserved_at` int(10) UNSIGNED DEFAULT NULL,
  `available_at` int(10) UNSIGNED NOT NULL,
  `created_at` int(10) UNSIGNED NOT NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- --------------------------------------------------------

--
-- Table structure for table `job_batches`
--

CREATE TABLE `job_batches` (
  `id` varchar(255) NOT NULL,
  `name` varchar(255) NOT NULL,
  `total_jobs` int(11) NOT NULL,
  `pending_jobs` int(11) NOT NULL,
  `failed_jobs` int(11) NOT NULL,
  `failed_job_ids` longtext NOT NULL,
  `options` mediumtext DEFAULT NULL,
  `cancelled_at` int(11) DEFAULT NULL,
  `created_at` int(11) NOT NULL,
  `finished_at` int(11) DEFAULT NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- --------------------------------------------------------

--
-- Table structure for table `liquidations`
--

CREATE TABLE `liquidations` (
  `id` bigint(20) UNSIGNED NOT NULL,
  `control_no` varchar(255) NOT NULL,
  `batch_no` varchar(255) DEFAULT NULL,
  `hei_id` bigint(20) UNSIGNED NOT NULL,
  `created_by` bigint(20) UNSIGNED DEFAULT NULL,
  `program_id` bigint(20) UNSIGNED NOT NULL,
  `academic_year` varchar(255) NOT NULL,
  `semester` varchar(255) NOT NULL,
  `amount_received` decimal(15,2) NOT NULL,
  `disbursed_amount` decimal(15,2) DEFAULT NULL COMMENT 'Amount disbursed to HEI',
  `disbursement_date` date DEFAULT NULL,
  `fund_source` varchar(255) DEFAULT NULL,
  `liquidated_amount` decimal(15,2) NOT NULL DEFAULT 0.00,
  `purpose` text DEFAULT NULL,
  `amount_disbursed` decimal(15,2) NOT NULL DEFAULT 0.00,
  `amount_refunded` decimal(15,2) NOT NULL DEFAULT 0.00,
  `or_number` varchar(255) DEFAULT NULL,
  `status` enum('draft','for_initial_review','returned_to_hei','endorsed_to_accounting','returned_to_rc','endorsed_to_coa','approved','rejected') NOT NULL DEFAULT 'draft',
  `transmittal_ref_no` varchar(255) DEFAULT NULL,
  `no_of_folders` int(11) DEFAULT NULL,
  `date_endorsed` date DEFAULT NULL,
  `endorsed_by` varchar(255) DEFAULT NULL,
  `file_location` varchar(255) DEFAULT NULL,
  `remarks` text DEFAULT NULL,
  `created_at` timestamp NULL DEFAULT NULL,
  `updated_at` timestamp NULL DEFAULT NULL,
  `reviewed_by` bigint(20) UNSIGNED DEFAULT NULL,
  `reviewed_at` timestamp NULL DEFAULT NULL,
  `review_remarks` text DEFAULT NULL,
  `accountant_reviewed_by` bigint(20) UNSIGNED DEFAULT NULL,
  `accountant_reviewed_at` timestamp NULL DEFAULT NULL,
  `accountant_remarks` text DEFAULT NULL,
  `coa_endorsed_by` bigint(20) UNSIGNED DEFAULT NULL,
  `coa_endorsed_at` timestamp NULL DEFAULT NULL,
  `deleted_at` timestamp NULL DEFAULT NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- --------------------------------------------------------

--
-- Table structure for table `liquidation_documents`
--

CREATE TABLE `liquidation_documents` (
  `id` bigint(20) UNSIGNED NOT NULL,
  `liquidation_id` bigint(20) UNSIGNED NOT NULL,
  `document_type` varchar(255) NOT NULL COMMENT 'e.g., Receipt, Invoice, Certificate, etc.',
  `file_name` varchar(255) NOT NULL,
  `file_path` varchar(255) NOT NULL,
  `file_type` varchar(255) DEFAULT NULL COMMENT 'MIME type',
  `file_size` int(11) DEFAULT NULL COMMENT 'File size in bytes',
  `description` text DEFAULT NULL,
  `uploaded_by` bigint(20) UNSIGNED NOT NULL,
  `created_at` timestamp NULL DEFAULT NULL,
  `updated_at` timestamp NULL DEFAULT NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- --------------------------------------------------------

--
-- Table structure for table `liquidation_items`
--

CREATE TABLE `liquidation_items` (
  `id` bigint(20) UNSIGNED NOT NULL,
  `liquidation_id` bigint(20) UNSIGNED NOT NULL,
  `student_no` varchar(255) DEFAULT NULL,
  `last_name` varchar(255) NOT NULL,
  `first_name` varchar(255) NOT NULL,
  `middle_name` varchar(255) DEFAULT NULL,
  `extension_name` varchar(255) DEFAULT NULL,
  `award_no` varchar(255) DEFAULT NULL,
  `amount` decimal(15,2) NOT NULL,
  `date_disbursed` date NOT NULL,
  `remarks` text DEFAULT NULL,
  `created_at` timestamp NULL DEFAULT NULL,
  `updated_at` timestamp NULL DEFAULT NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- --------------------------------------------------------

--
-- Table structure for table `migrations`
--

CREATE TABLE `migrations` (
  `id` int(10) UNSIGNED NOT NULL,
  `migration` varchar(255) NOT NULL,
  `batch` int(11) NOT NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

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
(9, '2026_01_19_025242_create_liquidations_table', 1),
(10, '2026_01_19_025253_create_liquidation_items_table', 1),
(11, '2026_01_19_074421_split_name_fields_in_liquidation_items_table', 1),
(12, '2026_01_20_000001_create_heis_table', 1),
(13, '2026_01_20_000003_create_liquidation_documents_table', 1),
(14, '2026_01_20_031750_add_batch_no_to_liquidations_table', 1),
(15, '2026_01_20_031833_add_tracking_columns_to_liquidations_table', 1),
(16, '2026_01_20_100000_add_workflow_columns_to_liquidations', 1);

-- --------------------------------------------------------

--
-- Table structure for table `password_reset_tokens`
--

CREATE TABLE `password_reset_tokens` (
  `email` varchar(255) NOT NULL,
  `token` varchar(255) NOT NULL,
  `created_at` timestamp NULL DEFAULT NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- --------------------------------------------------------

--
-- Table structure for table `permissions`
--

CREATE TABLE `permissions` (
  `id` bigint(20) UNSIGNED NOT NULL,
  `name` varchar(255) NOT NULL,
  `module` varchar(255) NOT NULL,
  `description` text DEFAULT NULL,
  `created_at` timestamp NULL DEFAULT NULL,
  `updated_at` timestamp NULL DEFAULT NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

--
-- Dumping data for table `permissions`
--

INSERT INTO `permissions` (`id`, `name`, `module`, `description`, `created_at`, `updated_at`) VALUES
(1, 'view_roles', 'Roles & Permissions', 'View roles list', '2026-01-20 05:10:44', '2026-01-20 05:10:44'),
(2, 'create_roles', 'Roles & Permissions', 'Create new roles', '2026-01-20 05:10:44', '2026-01-20 05:10:44'),
(3, 'edit_roles', 'Roles & Permissions', 'Edit existing roles', '2026-01-20 05:10:44', '2026-01-20 05:10:44'),
(4, 'delete_roles', 'Roles & Permissions', 'Delete roles', '2026-01-20 05:10:44', '2026-01-20 05:10:44'),
(5, 'view_users', 'User Management', 'View users list', '2026-01-20 05:10:44', '2026-01-20 05:10:44'),
(6, 'create_users', 'User Management', 'Create new users', '2026-01-20 05:10:44', '2026-01-20 05:10:44'),
(7, 'edit_users', 'User Management', 'Edit existing users', '2026-01-20 05:10:44', '2026-01-20 05:10:44'),
(8, 'delete_users', 'User Management', 'Delete users', '2026-01-20 05:10:44', '2026-01-20 05:10:44'),
(9, 'change_user_status', 'User Management', 'Activate/deactivate users', '2026-01-20 05:10:44', '2026-01-20 05:10:44'),
(10, 'view_hei', 'HEI', 'View HEI list', '2026-01-20 05:10:44', '2026-01-20 05:10:44'),
(11, 'create_hei', 'HEI', 'Create new HEI', '2026-01-20 05:10:44', '2026-01-20 05:10:44'),
(12, 'edit_hei', 'HEI', 'Edit existing HEI', '2026-01-20 05:10:44', '2026-01-20 05:10:44'),
(13, 'delete_hei', 'HEI', 'Delete HEI', '2026-01-20 05:10:44', '2026-01-20 05:10:44'),
(14, 'sync_hei_api', 'HEI', 'Sync HEI from API', '2026-01-20 05:10:44', '2026-01-20 05:10:44'),
(15, 'view_liquidation', 'Liquidation', 'View liquidation records', '2026-01-20 05:10:44', '2026-01-20 05:10:44'),
(16, 'create_liquidation', 'Liquidation', 'Create liquidation records', '2026-01-20 05:10:44', '2026-01-20 05:10:44'),
(17, 'edit_liquidation', 'Liquidation', 'Edit liquidation records', '2026-01-20 05:10:44', '2026-01-20 05:10:44'),
(18, 'delete_liquidation', 'Liquidation', 'Delete liquidation records', '2026-01-20 05:10:44', '2026-01-20 05:10:44'),
(19, 'review_liquidation', 'Liquidation', 'Review liquidation documents', '2026-01-20 05:10:44', '2026-01-20 05:10:44'),
(20, 'endorse_liquidation', 'Liquidation', 'Endorse liquidation to accounting', '2026-01-20 05:10:44', '2026-01-20 05:10:44'),
(21, 'view_reports', 'Reports', 'View reports', '2026-01-20 05:10:44', '2026-01-20 05:10:44'),
(22, 'export_reports', 'Reports', 'Export reports to Excel', '2026-01-20 05:10:44', '2026-01-20 05:10:44'),
(23, 'view_dashboard', 'Reports', 'View dashboard statistics', '2026-01-20 05:10:44', '2026-01-20 05:10:44');

-- --------------------------------------------------------

--
-- Table structure for table `roles`
--

CREATE TABLE `roles` (
  `id` bigint(20) UNSIGNED NOT NULL,
  `name` varchar(255) NOT NULL,
  `description` text DEFAULT NULL,
  `created_at` timestamp NULL DEFAULT NULL,
  `updated_at` timestamp NULL DEFAULT NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

--
-- Dumping data for table `roles`
--

INSERT INTO `roles` (`id`, `name`, `description`, `created_at`, `updated_at`) VALUES
(1, 'Super Admin', 'Has complete access to all system features', '2026-01-20 05:10:44', '2026-01-20 05:10:44'),
(2, 'Admin', 'System administrator', '2026-01-20 05:10:44', '2026-01-20 05:10:44'),
(3, 'Regional Coordinator', 'Reviews and endorses liquidation', '2026-01-20 05:10:44', '2026-01-20 05:10:44'),
(4, 'Accountant', 'Reviews and endorses to COA', '2026-01-20 05:10:44', '2026-01-20 05:10:44'),
(5, 'Encoder', 'Data entry staff', '2026-01-20 05:10:44', '2026-01-20 05:10:44'),
(6, 'Viewer', 'Read-only access', '2026-01-20 05:10:44', '2026-01-20 05:10:44');

-- --------------------------------------------------------

--
-- Table structure for table `role_permission`
--

CREATE TABLE `role_permission` (
  `id` bigint(20) UNSIGNED NOT NULL,
  `role_id` bigint(20) UNSIGNED NOT NULL,
  `permission_id` bigint(20) UNSIGNED NOT NULL,
  `created_at` timestamp NULL DEFAULT NULL,
  `updated_at` timestamp NULL DEFAULT NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

--
-- Dumping data for table `role_permission`
--

INSERT INTO `role_permission` (`id`, `role_id`, `permission_id`, `created_at`, `updated_at`) VALUES
(1, 1, 1, '2026-01-20 05:10:44', '2026-01-20 05:10:44'),
(2, 1, 2, '2026-01-20 05:10:44', '2026-01-20 05:10:44'),
(3, 1, 3, '2026-01-20 05:10:44', '2026-01-20 05:10:44'),
(4, 1, 4, '2026-01-20 05:10:44', '2026-01-20 05:10:44'),
(5, 1, 5, '2026-01-20 05:10:44', '2026-01-20 05:10:44'),
(6, 1, 6, '2026-01-20 05:10:44', '2026-01-20 05:10:44'),
(7, 1, 7, '2026-01-20 05:10:44', '2026-01-20 05:10:44'),
(8, 1, 8, '2026-01-20 05:10:44', '2026-01-20 05:10:44'),
(9, 1, 9, '2026-01-20 05:10:44', '2026-01-20 05:10:44'),
(10, 1, 10, '2026-01-20 05:10:44', '2026-01-20 05:10:44'),
(11, 1, 11, '2026-01-20 05:10:44', '2026-01-20 05:10:44'),
(12, 1, 12, '2026-01-20 05:10:44', '2026-01-20 05:10:44'),
(13, 1, 13, '2026-01-20 05:10:44', '2026-01-20 05:10:44'),
(14, 1, 14, '2026-01-20 05:10:44', '2026-01-20 05:10:44'),
(15, 1, 15, '2026-01-20 05:10:44', '2026-01-20 05:10:44'),
(16, 1, 16, '2026-01-20 05:10:44', '2026-01-20 05:10:44'),
(17, 1, 17, '2026-01-20 05:10:44', '2026-01-20 05:10:44'),
(18, 1, 18, '2026-01-20 05:10:44', '2026-01-20 05:10:44'),
(19, 1, 19, '2026-01-20 05:10:44', '2026-01-20 05:10:44'),
(20, 1, 20, '2026-01-20 05:10:44', '2026-01-20 05:10:44'),
(21, 1, 21, '2026-01-20 05:10:44', '2026-01-20 05:10:44'),
(22, 1, 22, '2026-01-20 05:10:44', '2026-01-20 05:10:44'),
(23, 1, 23, '2026-01-20 05:10:44', '2026-01-20 05:10:44'),
(24, 2, 9, '2026-01-20 05:10:44', '2026-01-20 05:10:44'),
(25, 2, 11, '2026-01-20 05:10:44', '2026-01-20 05:10:44'),
(26, 2, 16, '2026-01-20 05:10:44', '2026-01-20 05:10:44'),
(27, 2, 2, '2026-01-20 05:10:44', '2026-01-20 05:10:44'),
(28, 2, 6, '2026-01-20 05:10:44', '2026-01-20 05:10:44'),
(29, 2, 13, '2026-01-20 05:10:44', '2026-01-20 05:10:44'),
(30, 2, 18, '2026-01-20 05:10:44', '2026-01-20 05:10:44'),
(31, 2, 4, '2026-01-20 05:10:44', '2026-01-20 05:10:44'),
(32, 2, 8, '2026-01-20 05:10:44', '2026-01-20 05:10:44'),
(33, 2, 12, '2026-01-20 05:10:44', '2026-01-20 05:10:44'),
(34, 2, 17, '2026-01-20 05:10:44', '2026-01-20 05:10:44'),
(35, 2, 3, '2026-01-20 05:10:44', '2026-01-20 05:10:44'),
(36, 2, 7, '2026-01-20 05:10:44', '2026-01-20 05:10:44'),
(37, 2, 22, '2026-01-20 05:10:44', '2026-01-20 05:10:44'),
(38, 2, 14, '2026-01-20 05:10:44', '2026-01-20 05:10:44'),
(39, 2, 23, '2026-01-20 05:10:44', '2026-01-20 05:10:44'),
(40, 2, 10, '2026-01-20 05:10:44', '2026-01-20 05:10:44'),
(41, 2, 15, '2026-01-20 05:10:44', '2026-01-20 05:10:44'),
(42, 2, 21, '2026-01-20 05:10:44', '2026-01-20 05:10:44'),
(43, 2, 1, '2026-01-20 05:10:44', '2026-01-20 05:10:44'),
(44, 2, 5, '2026-01-20 05:10:44', '2026-01-20 05:10:44'),
(45, 3, 20, '2026-01-20 05:10:44', '2026-01-20 05:10:44'),
(46, 3, 19, '2026-01-20 05:10:44', '2026-01-20 05:10:44'),
(47, 3, 23, '2026-01-20 05:10:44', '2026-01-20 05:10:44'),
(48, 3, 10, '2026-01-20 05:10:44', '2026-01-20 05:10:44'),
(49, 3, 15, '2026-01-20 05:10:44', '2026-01-20 05:10:44'),
(50, 3, 21, '2026-01-20 05:10:44', '2026-01-20 05:10:44'),
(51, 4, 20, '2026-01-20 05:10:44', '2026-01-20 05:10:44'),
(52, 4, 19, '2026-01-20 05:10:44', '2026-01-20 05:10:44'),
(53, 4, 23, '2026-01-20 05:10:44', '2026-01-20 05:10:44'),
(54, 4, 10, '2026-01-20 05:10:44', '2026-01-20 05:10:44'),
(55, 4, 15, '2026-01-20 05:10:44', '2026-01-20 05:10:44'),
(56, 4, 21, '2026-01-20 05:10:44', '2026-01-20 05:10:44'),
(57, 5, 11, '2026-01-20 05:10:44', '2026-01-20 05:10:44'),
(58, 5, 16, '2026-01-20 05:10:44', '2026-01-20 05:10:44'),
(59, 5, 12, '2026-01-20 05:10:44', '2026-01-20 05:10:44'),
(60, 5, 17, '2026-01-20 05:10:44', '2026-01-20 05:10:44'),
(61, 5, 10, '2026-01-20 05:10:44', '2026-01-20 05:10:44'),
(62, 5, 15, '2026-01-20 05:10:44', '2026-01-20 05:10:44'),
(63, 6, 23, '2026-01-20 05:10:44', '2026-01-20 05:10:44'),
(64, 6, 10, '2026-01-20 05:10:44', '2026-01-20 05:10:44'),
(65, 6, 15, '2026-01-20 05:10:44', '2026-01-20 05:10:44'),
(66, 6, 21, '2026-01-20 05:10:44', '2026-01-20 05:10:44');

-- --------------------------------------------------------

--
-- Table structure for table `sessions`
--

CREATE TABLE `sessions` (
  `id` varchar(255) NOT NULL,
  `user_id` bigint(20) UNSIGNED DEFAULT NULL,
  `ip_address` varchar(45) DEFAULT NULL,
  `user_agent` text DEFAULT NULL,
  `payload` longtext NOT NULL,
  `last_activity` int(11) NOT NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

--
-- Dumping data for table `sessions`
--

INSERT INTO `sessions` (`id`, `user_id`, `ip_address`, `user_agent`, `payload`, `last_activity`) VALUES
('pWwx40gsELXcCWdIuYyN2hasdqBl3U85tzvwVlsI', 1, '127.0.0.1', 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/143.0.0.0 Safari/537.36', 'YTo0OntzOjY6Il90b2tlbiI7czo0MDoiYU9vcjNFc1JIV0ZWNmJoZEpVa1ZmVUZla2xlb2ZxN0NncUR2cXJlRyI7czo5OiJfcHJldmlvdXMiO2E6Mjp7czozOiJ1cmwiO3M6MjE6Imh0dHA6Ly8xMjcuMC4wLjE6ODAwMCI7czo1OiJyb3V0ZSI7czo0OiJob21lIjt9czo2OiJfZmxhc2giO2E6Mjp7czozOiJvbGQiO2E6MDp7fXM6MzoibmV3IjthOjA6e319czo1MDoibG9naW5fd2ViXzU5YmEzNmFkZGMyYjJmOTQwMTU4MGYwMTRjN2Y1OGVhNGUzMDk4OWQiO2k6MTt9', 1768914918);

-- --------------------------------------------------------

--
-- Table structure for table `users`
--

CREATE TABLE `users` (
  `id` bigint(20) UNSIGNED NOT NULL,
  `name` varchar(255) NOT NULL,
  `email` varchar(255) NOT NULL,
  `role_id` bigint(20) UNSIGNED DEFAULT NULL,
  `status` enum('active','inactive') NOT NULL DEFAULT 'active',
  `email_verified_at` timestamp NULL DEFAULT NULL,
  `password` varchar(255) NOT NULL,
  `two_factor_secret` text DEFAULT NULL,
  `two_factor_recovery_codes` text DEFAULT NULL,
  `two_factor_confirmed_at` timestamp NULL DEFAULT NULL,
  `remember_token` varchar(100) DEFAULT NULL,
  `created_at` timestamp NULL DEFAULT NULL,
  `updated_at` timestamp NULL DEFAULT NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

--
-- Dumping data for table `users`
--

INSERT INTO `users` (`id`, `name`, `email`, `role_id`, `status`, `email_verified_at`, `password`, `two_factor_secret`, `two_factor_recovery_codes`, `two_factor_confirmed_at`, `remember_token`, `created_at`, `updated_at`) VALUES
(1, 'Sadmin', 'sadmin@gmail.com', 1, 'active', NULL, '$2y$12$GWphPfPZHtVFGanB/57Vb.mWeb9ruNZ1KVkxna7lyJ4vpne4l6D/O', NULL, NULL, NULL, NULL, '2026-01-20 05:14:53', '2026-01-20 05:14:53');

--
-- Indexes for dumped tables
--

--
-- Indexes for table `cache`
--
ALTER TABLE `cache`
  ADD PRIMARY KEY (`key`);

--
-- Indexes for table `cache_locks`
--
ALTER TABLE `cache_locks`
  ADD PRIMARY KEY (`key`);

--
-- Indexes for table `failed_jobs`
--
ALTER TABLE `failed_jobs`
  ADD PRIMARY KEY (`id`),
  ADD UNIQUE KEY `failed_jobs_uuid_unique` (`uuid`);

--
-- Indexes for table `heis`
--
ALTER TABLE `heis`
  ADD PRIMARY KEY (`id`),
  ADD UNIQUE KEY `heis_code_unique` (`code`);

--
-- Indexes for table `jobs`
--
ALTER TABLE `jobs`
  ADD PRIMARY KEY (`id`),
  ADD KEY `jobs_queue_index` (`queue`);

--
-- Indexes for table `job_batches`
--
ALTER TABLE `job_batches`
  ADD PRIMARY KEY (`id`);

--
-- Indexes for table `liquidations`
--
ALTER TABLE `liquidations`
  ADD PRIMARY KEY (`id`),
  ADD UNIQUE KEY `liquidations_control_no_unique` (`control_no`),
  ADD KEY `liquidations_hei_id_status_index` (`hei_id`,`status`),
  ADD KEY `liquidations_created_by_foreign` (`created_by`),
  ADD KEY `liquidations_reviewed_by_foreign` (`reviewed_by`),
  ADD KEY `liquidations_accountant_reviewed_by_foreign` (`accountant_reviewed_by`),
  ADD KEY `liquidations_coa_endorsed_by_foreign` (`coa_endorsed_by`);

--
-- Indexes for table `liquidation_documents`
--
ALTER TABLE `liquidation_documents`
  ADD PRIMARY KEY (`id`),
  ADD KEY `liquidation_documents_liquidation_id_foreign` (`liquidation_id`),
  ADD KEY `liquidation_documents_uploaded_by_foreign` (`uploaded_by`);

--
-- Indexes for table `liquidation_items`
--
ALTER TABLE `liquidation_items`
  ADD PRIMARY KEY (`id`),
  ADD KEY `liquidation_items_liquidation_id_foreign` (`liquidation_id`);

--
-- Indexes for table `migrations`
--
ALTER TABLE `migrations`
  ADD PRIMARY KEY (`id`);

--
-- Indexes for table `password_reset_tokens`
--
ALTER TABLE `password_reset_tokens`
  ADD PRIMARY KEY (`email`);

--
-- Indexes for table `permissions`
--
ALTER TABLE `permissions`
  ADD PRIMARY KEY (`id`),
  ADD UNIQUE KEY `permissions_name_unique` (`name`);

--
-- Indexes for table `roles`
--
ALTER TABLE `roles`
  ADD PRIMARY KEY (`id`),
  ADD UNIQUE KEY `roles_name_unique` (`name`);

--
-- Indexes for table `role_permission`
--
ALTER TABLE `role_permission`
  ADD PRIMARY KEY (`id`),
  ADD UNIQUE KEY `role_permission_role_id_permission_id_unique` (`role_id`,`permission_id`),
  ADD KEY `role_permission_permission_id_foreign` (`permission_id`);

--
-- Indexes for table `sessions`
--
ALTER TABLE `sessions`
  ADD PRIMARY KEY (`id`),
  ADD KEY `sessions_user_id_index` (`user_id`),
  ADD KEY `sessions_last_activity_index` (`last_activity`);

--
-- Indexes for table `users`
--
ALTER TABLE `users`
  ADD PRIMARY KEY (`id`),
  ADD UNIQUE KEY `users_email_unique` (`email`),
  ADD KEY `users_role_id_foreign` (`role_id`);

--
-- AUTO_INCREMENT for dumped tables
--

--
-- AUTO_INCREMENT for table `failed_jobs`
--
ALTER TABLE `failed_jobs`
  MODIFY `id` bigint(20) UNSIGNED NOT NULL AUTO_INCREMENT;

--
-- AUTO_INCREMENT for table `heis`
--
ALTER TABLE `heis`
  MODIFY `id` bigint(20) UNSIGNED NOT NULL AUTO_INCREMENT;

--
-- AUTO_INCREMENT for table `jobs`
--
ALTER TABLE `jobs`
  MODIFY `id` bigint(20) UNSIGNED NOT NULL AUTO_INCREMENT;

--
-- AUTO_INCREMENT for table `liquidations`
--
ALTER TABLE `liquidations`
  MODIFY `id` bigint(20) UNSIGNED NOT NULL AUTO_INCREMENT;

--
-- AUTO_INCREMENT for table `liquidation_documents`
--
ALTER TABLE `liquidation_documents`
  MODIFY `id` bigint(20) UNSIGNED NOT NULL AUTO_INCREMENT;

--
-- AUTO_INCREMENT for table `liquidation_items`
--
ALTER TABLE `liquidation_items`
  MODIFY `id` bigint(20) UNSIGNED NOT NULL AUTO_INCREMENT;

--
-- AUTO_INCREMENT for table `migrations`
--
ALTER TABLE `migrations`
  MODIFY `id` int(10) UNSIGNED NOT NULL AUTO_INCREMENT, AUTO_INCREMENT=17;

--
-- AUTO_INCREMENT for table `permissions`
--
ALTER TABLE `permissions`
  MODIFY `id` bigint(20) UNSIGNED NOT NULL AUTO_INCREMENT, AUTO_INCREMENT=26;

--
-- AUTO_INCREMENT for table `roles`
--
ALTER TABLE `roles`
  MODIFY `id` bigint(20) UNSIGNED NOT NULL AUTO_INCREMENT, AUTO_INCREMENT=7;

--
-- AUTO_INCREMENT for table `role_permission`
--
ALTER TABLE `role_permission`
  MODIFY `id` bigint(20) UNSIGNED NOT NULL AUTO_INCREMENT, AUTO_INCREMENT=67;

--
-- AUTO_INCREMENT for table `users`
--
ALTER TABLE `users`
  MODIFY `id` bigint(20) UNSIGNED NOT NULL AUTO_INCREMENT, AUTO_INCREMENT=2;

--
-- Constraints for dumped tables
--

--
-- Constraints for table `liquidations`
--
ALTER TABLE `liquidations`
  ADD CONSTRAINT `liquidations_accountant_reviewed_by_foreign` FOREIGN KEY (`accountant_reviewed_by`) REFERENCES `users` (`id`),
  ADD CONSTRAINT `liquidations_coa_endorsed_by_foreign` FOREIGN KEY (`coa_endorsed_by`) REFERENCES `users` (`id`),
  ADD CONSTRAINT `liquidations_created_by_foreign` FOREIGN KEY (`created_by`) REFERENCES `users` (`id`) ON DELETE CASCADE,
  ADD CONSTRAINT `liquidations_reviewed_by_foreign` FOREIGN KEY (`reviewed_by`) REFERENCES `users` (`id`);

--
-- Constraints for table `liquidation_documents`
--
ALTER TABLE `liquidation_documents`
  ADD CONSTRAINT `liquidation_documents_liquidation_id_foreign` FOREIGN KEY (`liquidation_id`) REFERENCES `liquidations` (`id`) ON DELETE CASCADE,
  ADD CONSTRAINT `liquidation_documents_uploaded_by_foreign` FOREIGN KEY (`uploaded_by`) REFERENCES `users` (`id`);

--
-- Constraints for table `liquidation_items`
--
ALTER TABLE `liquidation_items`
  ADD CONSTRAINT `liquidation_items_liquidation_id_foreign` FOREIGN KEY (`liquidation_id`) REFERENCES `liquidations` (`id`) ON DELETE CASCADE;

--
-- Constraints for table `role_permission`
--
ALTER TABLE `role_permission`
  ADD CONSTRAINT `role_permission_permission_id_foreign` FOREIGN KEY (`permission_id`) REFERENCES `permissions` (`id`) ON DELETE CASCADE,
  ADD CONSTRAINT `role_permission_role_id_foreign` FOREIGN KEY (`role_id`) REFERENCES `roles` (`id`) ON DELETE CASCADE;

--
-- Constraints for table `users`
--
ALTER TABLE `users`
  ADD CONSTRAINT `users_role_id_foreign` FOREIGN KEY (`role_id`) REFERENCES `roles` (`id`) ON DELETE SET NULL;
COMMIT;

/*!40101 SET CHARACTER_SET_CLIENT=@OLD_CHARACTER_SET_CLIENT */;
/*!40101 SET CHARACTER_SET_RESULTS=@OLD_CHARACTER_SET_RESULTS */;
/*!40101 SET COLLATION_CONNECTION=@OLD_COLLATION_CONNECTION */;
