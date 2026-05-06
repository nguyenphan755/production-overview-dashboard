# Frontend Debugging Guide

## Issue: No Data Showing in UI

If the UI loads but shows no data, follow these steps to debug:

## Step 1: Check Browser Console

Open browser developer tools (F12) and check the Console tab. Look for:

### API Configuration Log
```
🔧 API Configuration:
   Base URL: http://100.94.207.3:3001/api
   Using Mock: true  ← ⚠️ If this is true, you're using mock data!
   Real-time: false
```

**If "Using Mock: true":**
- The frontend is using mock data, not the real API
- **Solution**: Create a `.env` file in the project root with:
  ```env
  VITE_USE_MOCK_DATA=false
  VITE_API_BASE_URL=http://100.94.207.3:3001/api
  ```
- **Important**: After creating `.env`, restart the frontend dev server!

### API Request Logs
Look for these logs:
- `🌐 API Request: http://100.94.207.3:3001/api/machines`
- `✅ API Success: /machines`
- `📦 Response structure: { hasData: true, dataType: 'array', dataLength: 10 }`

**If you see errors:**
- `❌ API Error` - Check the error message and URL
- Network errors - Check if backend is accessible

### Hook Response Logs
Look for:
- `🔍 useMachines response: { success: true, hasData: true, dataLength: 10 }`
- `✅ Machines data loaded: 10 machines`

**If success is false:**
- Check the `message` field for details
- Verify API endpoint is returning correct format

## Step 2: Check Network Tab

1. Open Network tab in developer tools
2. Filter by "Fetch/XHR"
3. Look for requests to `/api/machines`, `/api/areas`, `/api/kpis/global`

### Check Request Details:
- **Status**: Should be `200 OK`
- **Request URL**: Should match your Tailscale IP (e.g., `http://100.94.207.3:3001/api/machines`)
- **Response**: Click to see the actual JSON response

### Check Response Format:
The backend should return:
```json
{
  "data": [...],
  "success": true,
  "timestamp": "..."
}
```

If the response format is different, the frontend might not parse it correctly.

## Step 3: Verify Environment Variables

Create a `.env` file in the **project root** (same folder as `package.json`):

```env
# Use real API instead of mock data
VITE_USE_MOCK_DATA=false

# API Base URL (optional - auto-detected from hostname)
# VITE_API_BASE_URL=http://100.94.207.3:3001/api

# Enable real-time updates (optional)
VITE_REALTIME_ENABLED=false
```

**After creating `.env`:**
1. Stop the frontend dev server (Ctrl+C)
2. Restart: `npm run dev`
3. Check console for updated configuration

## Step 4: Test API Directly

In browser, open:
- `http://100.94.207.3:3001/api/machines`
- `http://100.94.207.3:3001/api/areas`
- `http://100.94.207.3:3001/api/kpis/global`

Each should return JSON with `data`, `success`, and `timestamp` fields.

## Step 5: Common Issues and Solutions

### Issue: "Using Mock: true" in console

**Cause**: No `.env` file or `VITE_USE_MOCK_DATA` not set to `false`

**Solution**:
1. Create `.env` file with `VITE_USE_MOCK_DATA=false`
2. Restart frontend dev server

### Issue: Network errors or CORS errors

**Cause**: Backend not accessible or CORS misconfigured

**Solution**:
1. Verify backend is running: `curl http://100.94.207.3:3001/health`
2. Check backend CORS configuration (should allow all origins in development)
3. Check firewall/network settings

### Issue: "Failed to fetch machines" error

**Cause**: API request failed

**Check**:
1. Backend is running and accessible
2. Network tab shows the request and response
3. Response format matches expected structure

### Issue: Data loads but doesn't display

**Cause**: State not updating or component not re-rendering

**Check**:
1. Console shows `✅ Machines data loaded: X machines`
2. React DevTools shows state has data
3. Component is receiving props/state correctly

### Issue: Empty array returned

**Cause**: Backend returns empty data or parsing issue

**Check**:
1. Direct API call shows data: `http://100.94.207.3:3001/api/machines`
2. Response structure matches expected format
3. Console shows response structure logs

## Step 6: Enable Detailed Logging

The code now includes detailed logging:

- **API Request**: Shows URL being called
- **API Response**: Shows response structure and data type
- **Hook Response**: Shows if data was successfully loaded
- **Error Logs**: Shows detailed error information

Check all these logs in the browser console to identify where the issue occurs.

## Quick Checklist

- [ ] `.env` file exists with `VITE_USE_MOCK_DATA=false`
- [ ] Frontend dev server restarted after creating `.env`
- [ ] Console shows `Using Mock: false`
- [ ] Console shows `API Request: http://...` (not localhost)
- [ ] Network tab shows successful API requests (200 OK)
- [ ] API response has `{ data: [...], success: true }` format
- [ ] Console shows `✅ Machines data loaded: X machines`
- [ ] React components are rendering but with no data

## Still Not Working?

1. Check all console logs and error messages
2. Check Network tab for failed requests
3. Verify backend is accessible directly in browser
4. Check backend console for errors
5. Verify database has data: `SELECT COUNT(*) FROM machines;`
