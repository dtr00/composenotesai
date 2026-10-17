---
name: workflow-pull-request
description: Create a pull request with a clear description and before and after screenshots, or full written documentation when there is nothing to show. Use whenever opening or updating a pull request.
---

# Create a pull request

Every pull request explains what changed and why, and shows it. A reviewer should understand the change without opening the diff.

## Steps

1. Finish the pre-push workflow in `AGENTS.md` on the diff against `origin/main`, then commit with `workflow-conventional-commit`.
2. Decide whether the change is visible: any change to what a user can see in the desktop app or the website, including generated images such as the link preview.
3. Visible change: capture before and after images (below). Not visible: skip to step 5 and write the full documentation section.
4. Host the images (below).
5. Write the body to a file from the template (below), then create the pull request with `gh pr create --base main --title "<conventional commit title>" --body-file <file>`.
6. Link the pull request to the thread when the `link_pull_request` tool exists.
7. Report the pull request URL, and say which images or sections you included.

## Capture images

- Capture the before image from `origin/main`, never from memory of how it looked. Check it out in a temporary worktree (`git worktree add "$(mktemp -d)" origin/main --detach`) and run it there. Remove the worktree afterwards.
- Capture the after image from the branch, the same way, so the two match in window size, zoom, theme, and data.
- Run the app by the rules in `AGENTS.md`, "Running the app as an agent": a separate port and identifier, a background process, bounded waits. Never touch the user's dev server or `notes.db`.
- Use demo data only. No real notes, names, paths, or keys in any image.
- For the website, screenshot the page at the same viewport width (1280 px wide and a phone width such as 390 px when layout changed).
- For a generated asset such as an image or icon, the before image is the asset on `origin/main` (or a note that none existed) and the after image is the new asset, shown as it appears where it is used.
- One pair per visible change. Crop to the area that changed when the full window adds nothing. Keep each file under about 400 KB: PNG or WebP, 1600 px wide at most.
- If a before image is impossible (new screen, new asset), say "New" in the Before cell and show only the after image.

## Host the images

Images live on an orphan `pr-assets` branch, never on the feature branch or `main`. That keeps the app repository small. The repository is public, so raw URLs render in the description.

```sh
REPO=$(gh repo view --json nameWithOwner -q .nameWithOwner)
DIR=$(git branch --show-current | tr '/' '-')
WT=$(mktemp -d)
if git ls-remote --exit-code --heads origin pr-assets >/dev/null 2>&1; then
  git fetch origin pr-assets
  git worktree add --detach "$WT" origin/pr-assets
else
  git worktree add --detach "$WT"
  git -C "$WT" checkout --orphan pr-assets
  git -C "$WT" rm -rf . -q
fi
mkdir -p "$WT/$DIR"
cp before.png after.png "$WT/$DIR/"
git -C "$WT" add "$DIR"
git -C "$WT" commit -m "chore: add images for $DIR"
git -C "$WT" push origin HEAD:pr-assets
SHA=$(git -C "$WT" rev-parse HEAD)
git worktree remove --force "$WT"
echo "https://raw.githubusercontent.com/$REPO/$SHA/$DIR/after.png"
```

Always link by commit SHA, not by branch name, so an image never changes under an old pull request. Look at the target before pushing: this branch holds images only, and the push must never touch another branch.

## Description template

Keep every section. Write plain sentences. No em dashes.

```md
## Summary

One to three sentences: what this changes and why.

## Changes

- Each user-visible or behavioural change, one bullet each.
- Name files, commands, settings, and routes where they help a reviewer find the change.
- Call out new dependencies, migrations, and config changes, or write "None".

## Before and after

| Before | After |
| ------ | ----- |
| ![Before: what it shows](raw-url-with-sha) | ![After: what it shows](raw-url-with-sha) |

## Testing

- The commands you ran (`bun run build`, `cargo test`, lint) and what you checked by hand.
- Anything you did not test, and why.

## Notes

Follow-ups, risks, deployment steps, and anything the reviewer needs to do after merge.
```

Give every image alt text that states what it shows. Add one row per pair of images, with a short heading above each table when there are several.

### No images

When the change has nothing to screenshot (native code, build, CI, docs, refactors), replace "Before and after" with "Documentation of changes" and write it out in full:

- **Before:** how it worked or behaved, in a few sentences.
- **After:** how it works now, in a few sentences.
- **Why:** the problem, the cause, and why this fix.
- **How it works:** the files involved and the flow through them. Use a short code or config snippet or a command output when it makes the change concrete.
- **How to verify:** exact steps a reviewer can follow.

## Rules

- The title is a Conventional Commit message, under 72 characters.
- Describe the whole branch, not only the last commit. Read `git log origin/main..HEAD` and `git diff origin/main...HEAD` before writing.
- Never claim anything you did not run or look at.
- Never put screenshots in the repository to host them.
- Updating an existing pull request: edit the body with `gh pr edit --body-file`, and refresh stale images.
- End the body with the attribution line the harness specifies, if any.
