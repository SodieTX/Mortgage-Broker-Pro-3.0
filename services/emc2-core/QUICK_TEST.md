# Quick Test - File Upload Baby Step

## 🚀 Get It Running (2 minutes)

```bash
# 1. Install dependencies
cd services/emc2-core
chmod +x setup-file-upload.sh
./setup-file-upload.sh

# 2. Start server
npm run dev

# 3. Open the UI in your browser
# Go to: http://localhost:3001/api/v1/lenders/upload-test
```

## 🎨 Visual Test (Much Easier!)

1. **Open in browser**: `http://localhost:3001/api/v1/lenders/upload-test`
2. **Download a sample file** (click the links on the page)
3. **Drag & drop or click to upload**
4. **See the parsed data instantly!**

## 🧪 Command Line Test (Optional)

```bash
node test-file-upload.js
```

## 🧪 Manual Test (Proves it works)

```bash
# Upload the valid CSV
curl -X POST http://localhost:3001/api/v1/lenders/upload-preview \
  -F "file=@test-files/valid-lenders.csv"

# Expected: JSON response with parsed data
```

## ✅ Success Indicators

If this baby step works, you'll see:
```json
{
  "success": true,
  "filename": "valid-lenders.csv",
  "rows": 10,
  "columns": ["Name", "Legal Name", "Tax ID", ...],
  "sample_data": [["First National Bank", ...], ...],
  "preview_id": "preview_123...",
  "file_info": { "size": 1234, "type": "text/csv" }
}
```

## ❌ If It Fails

1. **TypeScript errors**: Run `./setup-file-upload.sh` first
2. **Server won't start**: Check `npm install` completed
3. **404 errors**: Server not running on port 3001
4. **File not found**: Run from `services/emc2-core` directory

## 🎯 What This Proves

- ✅ File upload handling works
- ✅ CSV parsing works  
- ✅ Error handling works
- ✅ File validation works
- ✅ Ready for next baby step (column mapping)

**This baby step establishes the file processing pipeline foundation.**