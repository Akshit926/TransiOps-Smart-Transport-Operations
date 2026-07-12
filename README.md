# TransitOps - Smart Transport Operations Platform

TransitOps is a centralized, end-to-end transport operations platform that digitizes vehicle, driver, dispatch, maintenance, and expense management while enforcing strict business rules and providing real-time operational insights. 

Built for the **Odoo Hackathon** and aligned precisely with the visual mockups and functional PDF specifications.

---

## 🚀 Key Visual & Functional Alignments (PDF & Mockup Specs)

This implementation maps exactly to the provided mockups and PDF constraints:
1. **Split-Screen Authentication & Lockout**: Rebuilt the login screen into a two-column design. Implemented failed attempts locking—if a user submits incorrect credentials 5 times, the form locks and displays the mockup error state banner: *“Invalid credentials. Account locked after 5 failed attempts.”*
2. **Strict RBAC Navigation Scopes**: Navigation links are dynamically hidden/shown in the sidebar based on role permissions:
   - **Fleet Manager** &rarr; Fleet (Vehicles), Maintenance, Settings
   - **Driver** &rarr; Dashboard, Trips, Settings
   - **Safety Officer** &rarr; Drivers, Settings
   - **Financial Analyst** &rarr; Fuel & Expenses, Analytics, Settings
3. **Dashboard Horizontal Status Gauges**: Built visual status gauges on the dashboard reflecting ratio counts of Available (green), On Trip (blue), In Shop (orange), and Retired (red) vehicles.
4. **Drivers Roster Status Quick Toggles**: Clicking any driver highlights the row and enables a status toggle panel below the table (`Available`, `On Trip`, `Off Duty`, `Suspended`) to instantly change driver statuses.
5. **Trip Overload Validator & Live Board**:
   - The Create Trip form dynamically checks cargo weight against vehicle capacity. Overloading displays a red warning banner: *“Vehicle Capacity: X kg, Cargo Weight: Y kg, X Capacity exceeded by Z kg - dispatch blocked”* and disables submit.
   - The right side features a **Live Board** showing active, draft, and cancelled trip cards with custom ETAs/Notes.
6. **Maintenance Transition Guidelines**: Guides the user through transition routes: *Available &rarr; In Shop* and *In Shop &rarr; Available*.
7. **Fuel & Expenses calculation**: Accepts manual fuel cost input during trip completions or fuel logging. Calculates grand totals via: `TOTAL OPERATIONAL COST (AUTO) = FUEL + MAINT` using INR (₹) formatting.
8. **Reports & Analytics decimal ROI**: Displays fuel efficiency (km/L), total cost, and ROI using the exact PDF spec formula quotient:
   $$\text{ROI} = \frac{\text{Revenue} - (\text{Maintenance} + \text{Fuel})}{\text{Acquisition Cost}}$$
   Also includes a secondary `"Extended ROI (%)"` column in the detailed vehicle table for comprehensive tracking.

---

## 🛠️ Architecture & Tech Stack

- **Backend**: Node.js + Express.js
- **Database**: SQLite (via `sqlite3` package) with auto-fallback to file-based JSON database in case of system binary compile failures.
- **Frontend**: Single Page Application (SPA) built using modern vanilla HTML, CSS, and JS.
- **Visuals**: Premium glassmorphic UI, responsive sidebar, custom badge styles, and interactive visualizations using **Chart.js** and **Lucide Icons**.

---

## ⚙️ Installation & Setup

1. **Install dependencies**:
   ```bash
   npm install
   ```

2. **Seed the database**:
   ```bash
   npm run seed
   ```
   *Note: Recreates the SQLite schema and seeds demo accounts, vehicle assets, and driver compliance parameters.*

3. **Start the server**:
   ```bash
   npm run dev
   ```

4. **Access the application**:
   Open [http://localhost:5000](http://localhost:5000) in your web browser.

---

## 🧪 Automated Verification Suite
Run the automated check script to verify the API endpoints, database triggers, and business validations:
```bash
node backend/verify.js
```
The verification suite checks login sequences, KPI computations, trip validations, driver warnings, fuel logging, maintenance resolution flows, and spec-compliant ROI calculations.

---

## 🔑 Demo Accounts (RBAC)

The login screen features "Quick Login" shortcut buttons, or you can sign in manually using:

| Role | Email | Password | Landing Page | Permissions Scope |
| :--- | :--- | :--- | :--- | :--- |
| **Fleet Manager** | `manager@transitops.com` | `password123` | Fleet Registry | Oversees fleet assets, vehicle lifecycle, maintenance logs, and document registry. |
| **Driver** | `driver@transitops.com` | `password123` | Dashboard | Trip lifecycle dispatcher (create/complete/cancel), Live Board, and fuel cost logs. |
| **Safety Officer** | `safety@transitops.com` | `password123` | Drivers | Driver compliance, license registrations, safety score reviews, and email reminders. |
| **Financial Analyst** | `finance@transitops.com` | `password123` | Fuel & Expenses | Operating expense logs, fuel logs, and ROI reports. |
