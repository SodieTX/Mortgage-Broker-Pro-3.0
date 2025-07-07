# 🎨 File Upload UI Test

**Much easier than curl commands!** Now you can see the file upload working in your browser.

## 🚀 Quick Start

```bash
# 1. Setup (if not done already)
cd services/emc2-core
chmod +x setup-file-upload.sh
./setup-file-upload.sh

# 2. Start server
npm run dev

# 3. Open in browser
open http://localhost:3001/api/v1/lenders/upload-test
```

## 🎯 What You'll See

**A clean, modern upload interface with:**
- Drag & drop file upload area
- File selection button
- Real-time upload progress
- Parsed data displayed in a table
- Clear error messages for invalid files

## 📝 How to Test

### **Create a Test CSV File**
Create a file called `test-lenders.csv`:
```csv
Name,Legal Name,Contact Email,Contact Phone,Website,Profile Score,Tier
First Bank,First Bank Corp,contact@first.com,555-0123,https://first.com,85,GOLD
Second Bank,Second Bank LLC,info@second.com,555-0456,https://second.com,92,PLATINUM
```

### **Upload & See Results**
1. **Drag the file** into the upload area (or click to browse)
2. **Click "Upload & Parse"**
3. **See the magic happen:**
   - ✅ Success message
   - 📊 File stats (rows, size, etc.)
   - 📋 Column names found
   - 📝 Data displayed in a nice table

### **Test Error Handling**
Try uploading:
- An empty file → See error message
- A .txt file → See rejection
- A file with inconsistent columns → See warnings

## 🔧 Technical Details

**URL**: `http://localhost:3001/api/v1/lenders/upload-test`

**Features**:
- Drag & drop upload
- File type validation  
- Visual feedback during upload
- Responsive design
- Error handling with clear messages
- Data preview in table format

## 🎉 Success Looks Like

When you upload a valid CSV, you'll see:
```
✅ Upload Successful!
File: test-lenders.csv
Rows: 2
File Size: 245 bytes
Preview ID: preview_1704589234_abc123

📋 Columns Found:
Name, Legal Name, Contact Email, Contact Phone, Website, Profile Score, Tier

📊 Sample Data (first 2 rows):
[Nice table showing your data]
```

## 🚫 If It Doesn't Work

1. **Server not running?** → `npm run dev`
2. **TypeScript errors?** → Run `./setup-file-upload.sh`
3. **404 error?** → Check you're on the right URL
4. **Upload fails?** → Check browser console for errors

---

**This UI proves the file upload baby step works and makes it easy for anyone to test! 🎯**