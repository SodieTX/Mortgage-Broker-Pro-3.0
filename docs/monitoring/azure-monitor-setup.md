# Azure Monitor & Alerting Setup

## Logging
- All services log to stdout/stderr (see `/health` endpoints for liveness).
- Use Azure Monitor or Application Insights to collect logs and metrics.

## Alerting
- Set up alerts in Azure Monitor for error logs, downtime, or high latency.
- Example: Alert if `/health` endpoint returns non-200 for more than 5 minutes.

## Automated Recovery
- Use Azure App Service or Container restart policies to auto-restart failed services.

## References
- [Azure Monitor Docs](https://learn.microsoft.com/en-us/azure/azure-monitor/)
- [App Service Health Checks](https://learn.microsoft.com/en-us/azure/app-service/monitor-instances-health-check)
