# Domain Image Sorter
---

An Obsidian plugin that automatically downloads and organizes image attachments based on the source domain of clipped notes.  
It is intended to work alongside [Obsidian Web Clipper](https://obsidian.md/clipper). It's also nice to have **Obsidan Bases**.

### Usage
---

When you use the Obsidian Web Clipper, new notes are created with frontmatter that includes fields like:

```yaml
Link: https://www.goodreads.com/book/show/23395680-illuminae?ref=nav_sb_ss_1_8
Image: https://images-na.ssl-images-amazon.com/books/1738704267i/49552.jpg
Title: Illuminae
Author: Amie Kaufman, Jay Kristoff
```

**Domain Image Sorter automatically:**

- Detects the `Image` property in your clipped note and downloads the image into your vault
- Renames the image according to your note’s `Title` and `Author` properties.  
- Updates the YAML frontmatter to reference the new local image.
- Detects the `Link` property in your clipped note.  
- Determines which website it came from (e.g., Goodreads, NovelUpdates, etc.).  
- Moves the associated image into a vault-relative folder based on that domain.  

### Settings
---

You can add and delete domain-imagefolder mappings in the settings tab. 

#### Example Folder Mapping

| **Source** | **Image Destination** |
|-------------|------------------------|
| `goodreads.com` | `images/book-images/` |
| `novelupdates.com` | `images/webnovel-images/` |
| `novelbin.me` | `images/webnovel-images/` |

### Example WorkFlow
---

1. Clip a webpage using Obsidian Web Clipper. ex. clip https://www.goodreads.com/book/show/23395680-illuminae?ref=nav_sb_ss_1_8
2. Domain Image Sorter downloads the online image and renames it. ex. "img783192.jpg" -> "Illuminae-Amie Kaufman, Jay Kristoff.jpg"
3. The image is moved to desired folder. ex. images/book-images
4. YAML frontmatter in clipped file is linked to downloaded image. ex. [[Illuminae-Amie Kaufman, Jay Kristoff.jpg]]

### Developer Notes
---

This plugin was born out of my chronic webnovel addiction. Webnovel sites go down frequently due to copyright claims or domain migrations, and it's near impossible to have a permanent site where you can bookmark reads and rate them. Unlike centralized databases like Goodreads, webnovels are also scattered among a lot of sites including indie translator groups and webnovel platforms (Webnovel, RoyalRoad, Wattpad, Foxaholic, Novelbin, shanghaifantasy etc.). I wanted a local way to keep track of the webnovels I read directly in my obsidian vault with access to the cover images. That way, my pretty bases card layout remains unaffected even if a site gets taken down.  

Also, be aware that since this plugin was initially designed with webnovels in mind, image filenames are currently auto-generated as {title}-{author}. I'm planning to add a customizable naming field to the settings tab in a future update

### Installation
---

1. Clone or download this repository into your vault’s plugins folder:.obsidian/plugins/domain-image-sorter/

2. Run the following commands in that folder:

```bash
npm install
npm run build
```

3. Open Obsidian → Settings → Community Plugins → Installed Plugins
Find Domain Image Sorter and toggle it on.

4. Restart Obsidian

