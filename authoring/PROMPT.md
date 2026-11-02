# Prompts for making a Penwork presentation

Give the AI the files in this kit along with your lesson material, then paste one of these.

## In Claude chat

```
Make me a Penwork presentation from the material I've attached.

Read AI-GUIDE.md first and follow it exactly. Write these files:
manifest.json, slides.html, and theme.css if the colours should change.
Look at example/ to see them done properly.

Run pwpptx.py check on your folder and fix anything it reports. Then run
pwpptx.py pack to make the .pwpptx, and give me that file to download.

Topic and audience: [WHAT IT IS AND WHO IT'S FOR]
Language: [LANGUAGE]
Number of slides: about [NUMBER]
```

## In Claude Code

```
Read AI-GUIDE.md, then make a Penwork presentation from [YOUR MATERIAL].

Put the files in a new folder called [NAME], using example/ as the pattern.
Run: python pwpptx.py check [NAME] --shots [NAME]-shots
Look at the pictures and fix what's wrong, then run:
python pwpptx.py pack [NAME] [NAME].pwpptx

Topic and audience: [WHAT IT IS AND WHO IT'S FOR]
Language: [LANGUAGE]
```

## Changing one slide

You don't need the kit for this. In Penwork, type what you want under **Ask AI** in the panel on the
right, click **Copy slide**, paste it into your AI chat, copy its reply, and click **Paste reply**.
