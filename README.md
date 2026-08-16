# taoulu scoring2

قم بفتح هده المنصة مع المحافظة على مكتسباتها وصفحاتها الجيدة مع القيام بهده الاصلاحات واصلاح كل الاخطاء. CRITICAL FIX - SESSION MANAGEMENT & EXCEL IMPORT:

1. Session Persistence:

   - Fix the Session Code logic (e.g., XYPTGG). When a session is created, it must persist in the database/localStorage.

   - Any role (TA, Judge A/B/C, VAR) entering the valid Session Code must be authenticated successfully without "فشل الدخول".

   - Leaving or refreshing the page must NOT destroy active session tokens.

2. Excel Import & Tournament Setup:

   - Fix the "استيراد" and "إعدادات البطولة" modal in Technical Assistant view.

   - Importing an Excel file must correctly parse athlete rows (Name, Club, Category, Style, Difficulty Sheet) and populate the match queue immediately.

   - Clicking "إنشاء البطولة" must save and activate the schedule for the current session.

This project was built with [Lovable](https://lovable.dev).

**Live app**: https://session-stable.lovable.app

## Build with Lovable

Continue developing this project in the [Lovable editor](https://lovable.dev/projects/090357b1-eebe-47ba-85e2-4e93f605363e).

- **Ship faster**: describe what you want to build and Lovable handles the code.
- **Stay in sync**: every change made in Lovable is committed straight to this repository.
- **Full ownership**: this code is yours. Push to `main` on GitHub and your changes sync back into Lovable, ready for your next prompt.

## Development

Prefer working locally? You need Node.js and npm — [install with nvm](https://github.com/nvm-sh/nvm#installing-and-updating).

```sh
git clone <this-repository-url>
cd <repository-name>
npm i
npm run dev
```
