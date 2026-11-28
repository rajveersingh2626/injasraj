# Antigravity Data Migration & Desktop Setup Guide

Hi Jasraj,

Here are the complete step-by-step instructions to migrate your Antigravity chats, session memory, and workspace configuration from your laptop to your desktop, along with options to transfer the data.

---

## 1. Important Note on Email Attachments
Your total Antigravity history consists of **469 conversation databases totaling ~4.17 GB**. 
Because Gmail has a **25 MB attachment limit**, standard email attachments cannot hold the entire history. 

Below are the exact instructions to transfer:
1. **The Current Live Projects & Recent Sessions** (< 25 MB)
2. **The Full 4.17 GB Complete History** (via Tailscale or USB drive)

---

## 2. Fast Transfer Methods

### Option A: Direct Transfer via Tailscale (Zero USB, Zero Size Limit)
Since you already have Tailscale running:
1. Ensure Tailscale is installed and logged in on both your laptop and desktop.
2. On your **Laptop**, zip the data:
   ```powershell
   Compress-Archive -Path "$env:USERPROFILE\.gemini\antigravity\conversations", "$env:USERPROFILE\.gemini\antigravity\brain" -DestinationPath "$env:USERPROFILE\Desktop\antigravity_backup.zip"
   ```
3. Send it directly over Tailscale:
   ```powershell
   tailscale file cp "$env:USERPROFILE\Desktop\antigravity_backup.zip" <desktop-device-name>:
   ```
4. On your **Desktop**:
   ```powershell
   tailscale file get .
   Expand-Archive -Path "antigravity_backup.zip" -DestinationPath "$env:USERPROFILE\.gemini\antigravity\" -Force
   ```

---

### Option B: Using a USB Pen Drive / External SSD
1. Close Antigravity on your laptop.
2. Copy these two folders from your laptop:
   - `C:\Users\<YourUsername>\.gemini\antigravity\conversations`
   - `C:\Users\<YourUsername>\.gemini\antigravity\brain`
3. Paste them into the exact same location on your desktop:
   - `C:\Users\<DesktopUsername>\.gemini\antigravity\`
4. Launch Antigravity on your desktop. All 469 conversations, transcripts, and artifacts will appear in your sidebar.

---

### Option C: Google Drive (If You Prefer Cloud Download)
1. Compress your `.gemini\antigravity` folder into a zip file.
2. Upload it to your Google Drive account (`pinky1379@googlemail.com` or `jasraj2626@gmail.com`).
3. Download and extract it onto your desktop.

---

## 3. Desktop Antigravity Setup Checklist
Once the files are copied:
1. Open Antigravity on the desktop.
2. Re-open your workspace folder:
   - `Injasraj` (`c:\Users\...\Injasraj`)
3. All prior conversation context, plans, artifacts, and tools will be recognized seamlessly.
