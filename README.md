# Microbiome Atlas

[![Vercel Deployment](https://img.shields.io/badge/Vercel-Deployed-black?logo=vercel&logoColor=white)](https://microbiome-atlas.vercel.app)
[![React](https://img.shields.io/badge/React-19.0-blue?logo=react&logoColor=white)](https://react.dev/)
[![TypeScript](https://img.shields.io/badge/TypeScript-5.7-blue?logo=typescript&logoColor=white)](https://www.typescriptlang.org/)
[![Tailwind CSS](https://img.shields.io/badge/Tailwind_CSS-v4-38bdf8?logo=tailwindcss&logoColor=white)](https://tailwindcss.com/)
[![Supabase](https://img.shields.io/badge/Supabase-Auth_%26_PostgreSQL-3ecf8e?logo=supabase&logoColor=white)](https://supabase.com/)
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](https://opensource.org/licenses/MIT)

An interactive, high-performance web platform for microbial ecology and diversity analysis. Microbiome Atlas allows researchers, bioinformaticians, and students to upload OTU/ASV microbial abundance tables, compute diversity metrics in real-time, explore taxonomic hierarchies, and export publication-ready reports.

🌐 **Live Application:** [https://microbiome-atlas.vercel.app](https://microbiome-atlas.vercel.app)  
📦 **Repository:** [https://github.com/Guhan277-code/Microbiome-Atlas](https://github.com/Guhan277-code/Microbiome-Atlas)

---

## Table of Contents

- [Features](#features)
- [Scientific Methodology](#scientific-methodology)
- [Architecture & Tech Stack](#architecture--tech-stack)
- [Project Structure](#project-structure)
- [Getting Started](#getting-started)
  - [Prerequisites](#prerequisites)
  - [Installation](#installation)
  - [Environment Configuration](#environment-configuration)
  - [Database Setup](#database-setup)
- [Running Locally](#running-locally)
- [Testing](#testing)
- [Deployment](#deployment)
- [Security & Validation](#security--validation)
- [Contributing](#contributing)
- [License](#license)

---

## Features

- **Interactive Data Ingestion & Wizard:**
  - Drag-and-drop CSV upload for microbial abundance matrices and OTU/ASV tables.
  - Automatic column delimiter, header, and lineage format detection.
  - Built-in preloaded datasets (Human Gut, Marine Water Column, Soil Rhizosphere) for instant exploration.
- **Taxonomic Explorer & Sunburst Visualization:**
  - Multi-level taxonomic navigation spanning all seven ranks: **Domain, Phylum, Class, Order, Family, Genus, Species**.
  - Interactive sunburst and hierarchical breadcrumb tree with real-time relative abundance calculation.
- **Alpha Diversity Profiling:**
  - Simultaneous evaluation of **Shannon Entropy ($H'$)**, **Gini-Simpson Index ($1-D$)**, **Observed Richness ($S$)**, and **Pielou's Evenness ($J'$)**.
  - Side-by-side sample metric cards with sample group filtering.
- **Beta Diversity & Ordination:**
  - Pairwise **Bray-Curtis Dissimilarity** matrix computation.
  - Two-dimensional **Principal Coordinates Analysis (PCoA)** scatter ordination with interactive coordinate tooltips.
- **Microbial Composition Charts & Heatmaps:**
  - Relative and raw abundance stacked representations.
  - Dynamic Top-N taxon filtering.
  - High-density abundance heatmaps for sample-to-sample comparison.
- **Publication-Ready Export & Reporting:**
  - High-contrast, printable scientific summary reports (`print-color-adjust: exact`).
  - CSV export with formula injection sanitization.
- **Supabase Cloud Sync & Authentication:**
  - Secure user registration, login, and password recovery.
  - Automatic user profile provisioning via PostgreSQL triggers.
  - Dataset and report persistence governed by Row Level Security (RLS).

---

## Scientific Methodology

Microbiome Atlas adheres strictly to standard ecological and metagenomic quantitative definitions:

### 1. Relative Abundance Matrix ($P$)
Given raw counts $C_{i,j}$ for taxon $i$ in sample $j$:
$$p_{i,j} = \frac{C_{i,j}}{\sum_{k} C_{k,j}}$$
Samples with zero total abundance are guarded against division by zero.

### 2. Alpha Diversity Indices
- **Observed Species Richness ($S$):**
  $$S = \sum [p_{i} > 0]$$
- **Shannon Index ($H'$):**
  $$H' = -\sum_{i=1}^{S} p_i \ln(p_i) \quad \text{where } p_i > 0$$
- **Gini-Simpson Diversity Index ($1-D$):**
  $$1 - D = 1 - \sum_{i=1}^{S} p_i^2$$
- **Pielou's Evenness ($J'$):**
  $$J' = \frac{H'}{\ln(S)} \quad \text{for } S > 1 \text{ (defined as 1 when } S = 1\text{)}$$

### 3. Beta Diversity (Bray-Curtis Dissimilarity)
For any pair of samples $j$ and $k$:
$$BC_{j,k} = \frac{\sum_i |C_{i,j} - C_{i,k}|}{\sum_i (C_{i,j} + C_{i,k})}$$
Satisfies $BC_{j,j} = 0$ and $0 \le BC_{j,k} \le 1$.

### 4. Principal Coordinates Analysis (PCoA)
- Computes centering matrix $B = -\frac{1}{2} H D^2 H$ where $H = I - \frac{1}{n}\mathbf{1}\mathbf{1}^T$.
- Extracts principal eigenvectors via iterative power iteration with deflation to yield coordinate axes accounting for maximum explained variation.

---

## Architecture & Tech Stack

| Layer | Technologies |
|---|---|
| **Frontend Framework** | React 19, TypeScript 5.7, Vite 8 |
| **Styling & UI** | Tailwind CSS v4, Lucide Icons |
| **Authentication & Database** | Supabase (PostgreSQL 15+, Row Level Security, GoTrue Auth) |
| **Scientific Testing** | Native Node.js Test Runner (`node --test`), TypeScript |
| **Hosting & CI/CD** | Vercel (Production Git-integrated edge deployments) |

---

## Project Structure

```
├── .figma/                     # Figma Make site configuration & presets
├── public/                     # Static assets (favicons, demo data, icons)
├── src/
│   ├── lib/
│   │   ├── science.ts          # Core ecological algorithms (alpha, beta, PCoA, matrix normalization)
│   │   └── supabase.ts         # Centralized Supabase client with graceful mock fallback
│   ├── pages/
│   │   ├── Analysis1.tsx       # Composition, Alpha diversity & Beta diversity views
│   │   ├── Analysis2.tsx       # Taxonomic Explorer, Sample Comparison & Advanced analytics
│   │   ├── Auth.tsx            # Sign in, Sign up, and Password reset interfaces
│   │   ├── Datasets.tsx        # Uploaded dataset manager & inspection
│   │   ├── Landing.tsx         # Product overview & hero landing page
│   │   ├── Misc.tsx            # Activity log, Documentation & App settings
│   │   ├── Overview.tsx        # High-level workspace summary
│   │   ├── Results.tsx         # Publication reports & export center
│   │   └── Wizard.tsx          # Step-by-step dataset upload & column mapping wizard
│   ├── App.tsx                 # Root application router and error boundary
│   ├── Shell.tsx               # Workspace navigation shell and header
│   ├── store.tsx               # Global React context, persistence, and state sync
│   ├── ui.tsx                  # Reusable UI component library (buttons, inputs, cards)
│   ├── index.css               # Global CSS entrypoint with Tailwind v4 layers
│   └── main.tsx                # React DOM mount entrypoint
├── supabase/
│   └── schema.sql              # PostgreSQL DDL migrations, RLS policies & triggers
├── tests/
│   └── science.test.ts         # Mathematical invariant & validation test suite
├── vercel.json                 # Vercel deployment configuration, rewrites & CSP headers
├── vite.config.ts              # Vite 8 configuration with Tailwind v4 & React plugins
└── package.json                # Project dependencies and script declarations
```

---

## Getting Started

### Prerequisites

- **Node.js** >= 20.x
- **npm** >= 10.x
- A free **[Supabase](https://supabase.com/)** project (for cloud storage and user authentication)

### Installation

1. Clone the repository:
   ```bash
   git clone https://github.com/Guhan277-code/Microbiome-Atlas.git
   cd Microbiome-Atlas
   ```

2. Install dependencies:
   ```bash
   npm install
   ```

### Environment Configuration

Create a `.env` file in the root directory (based on `.env.example`):

```bash
VITE_SUPABASE_URL=https://your-project-id.supabase.co
VITE_SUPABASE_PUBLISHABLE_KEY=sb_publishable_your_key_here
```

> **Note:** If no credentials are provided, Microbiome Atlas operates in local-first demo mode with full offline analytical functionality.

### Database Setup

To enable user profiles, saved datasets, and reports in Supabase:

1. Open your [Supabase Dashboard](https://supabase.com/dashboard).
2. Navigate to the **SQL Editor**.
3. Open [`supabase/schema.sql`](supabase/schema.sql) in this repo, copy its contents, and click **Run**.
4. This creates:
   - `profiles` table with automatic signup synchronization triggers.
   - `datasets` table with JSON abundance payload storage and Row Level Security (RLS).
   - `reports` and `activity_logs` tables.

---

## Running Locally

Start the local development server:

```bash
npm run dev
```

The application will be accessible at:
```
http://localhost:8443
```

---

## Testing

Run the automated mathematical invariant and scientific validation test suite:

```bash
node --test tests/science.test.ts
```

The test suite validates:
- Shannon, Simpson, Richness, and Pielou index calculations against analytical proofs.
- Bray-Curtis boundary conditions ($BC_{i,i} = 0$, $0 \le BC \le 1$).
- PCoA eigenvalue deflation and matrix symmetry.
- CSV parsing error boundaries, malformed quotes, and formula injection mitigations.
- Outlier detection behavior when $\text{IQR} = 0$.

---

## Deployment

Microbiome Atlas is configured for automated continuous deployment via **Vercel**:

- **Production Branch:** `main`
- **Build Command:** `npm run build`
- **Output Directory:** `dist`
- **SPA Rewrites & Security Headers:** Configured via [`vercel.json`](vercel.json).

To deploy your own fork:
1. Import the repository in [Vercel](https://vercel.com/new).
2. Set the framework preset to **Vite**.
3. Add the `VITE_SUPABASE_URL` and `VITE_SUPABASE_PUBLISHABLE_KEY` environment variables.
4. Click **Deploy**.

---

## Security & Validation

- **Content Security Policy (CSP):** Enforces strict script and connect boundaries; only whitelists verified Supabase domains (`*.supabase.co`).
- **Row Level Security (RLS):** All user tables in PostgreSQL restrict read/write access to the authenticated owner (`auth.uid() = user_id`).
- **CSV Formula Sanitization:** Cells starting with formula characters (`=`, `+`, `-`, `@`) are escaped to prevent CSV injection vulnerabilities during spreadsheet export.
- **Input Sanitization:** OTU/ASV taxonomy labels are stripped of control characters and normalized before hierarchical tree aggregation.

---

## License

This project is licensed under the [MIT License](LICENSE).
