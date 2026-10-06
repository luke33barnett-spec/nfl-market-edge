# Fresh setup

Use this guide instead of the older update instructions in SBD-SETUP.md. This fresh package already enables SBD in the workflow; no SBD_ENABLED repository variable is needed.

1. Create a public GitHub repository named nfl-market-edge. Select Add a README so the repository starts with a main branch.
2. Extract the fresh ZIP. Open the extracted folder where .github, data, public, scripts, tests and package.json are together.
3. In the new repository's Code tab, choose Add file → Upload files. Drag the folders AND top-level files together from Windows File Explorer. Do not use the file picker to select files from inside each folder. Do not drag the ZIP or an outer container folder. Confirm upload paths include scripts/refresh.mjs and public/lib/week.mjs, then commit to main.
4. Confirm .github/workflows/refresh.yml exists. The .github folder must be included in the upload. In Windows File Explorer, View → Show → Hidden items can help locate dotfiles if missing.
5. Settings → Secrets and variables → Actions → Secrets → New repository secret. Name ODDS_API_KEY; value is your existing The Odds API key. Deleting the repository deleted its secrets, but did not invalidate the provider's key.
6. Actions → Collect NFL markets → Run workflow. Look for SBD: ... matched spread splits in the collection step. The default site begins in explicitly labeled demo mode until a successful odds refresh.
7. In Vercel, import the newly created repository as a new project. If the old project name is taken, use nfl-market-edge-v2. Framework Other; root directory default; build command npm run check; output directory public.
8. On that Vercel project, Settings → Git → Deploy Hooks: name Market Updates, branch main. Copy the hook URL. In GitHub add a repository secret named VERCEL_DEPLOY_HOOK with that URL. Start another workflow run to check the full update and deployment.

The collector runs twice daily. SBD uses a tested public but undocumented request, so availability is not guaranteed. Source update times remain intact, failures don't stop odds collection, and percentages do not identify professional bettors. SBD's published restrictions on automated collection still apply; this technical integration doesn't establish usage permission.

The site displays upcoming games through Monday in Central Time, including doubleheaders. Later games within the odds collection window are saved for later slates. This fresh package resets collected history.

If paths look wrong, stop before committing and inspect the upload list. Correct paths are more important than uploading every individual file quickly.
