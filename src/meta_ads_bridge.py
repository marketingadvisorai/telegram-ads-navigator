import json
import subprocess
import urllib.parse
from pathlib import Path

ENV_PATH = Path('/opt/openclaw/workspace/secrets/.env.meta-ads-new')


def load_token():
    vals = {}
    for line in ENV_PATH.read_text().splitlines():
        if line.startswith('#') or '=' not in line:
            continue
        k, v = line.split('=', 1)
        vals[k.strip()] = v.strip().strip('"')
    return vals['META_ACCESS_TOKEN']


def fetch(path, params):
    token = load_token()
    params = dict(params)
    params['access_token'] = token
    url = 'https://graph.facebook.com/v22.0/' + path + '?' + urllib.parse.urlencode(params)
    out = subprocess.check_output(['curl', '-s', url], text=True)
    data = json.loads(out)
    if 'error' in data:
        raise RuntimeError(data['error'].get('message', 'Meta API error'))
    return data


def list_accounts():
    obj = fetch('me/adaccounts', {'fields': 'id,name,account_status,currency,timezone_name', 'limit': '100'})
    return [{
        'id': row['id'].replace('act_', ''),
        'name': row.get('name') or row['id'],
        'businessName': row.get('name') or row['id'],
        'platform': 'Meta Ads',
        'currency': row.get('currency', 'USD'),
        'status': row.get('account_status'),
        'timezone': row.get('timezone_name', ''),
    } for row in obj.get('data', [])]


def account_summary(account_id):
    act_id = account_id if str(account_id).startswith('act_') else f'act_{account_id}'
    details = fetch(act_id, {'fields': 'id,name,account_status,currency,timezone_name,business{id,name},owner_business{name},end_advertiser_name'})
    insights = fetch(f'{act_id}/insights', {'fields': 'spend,impressions,clicks,cpc,ctr,actions', 'date_preset': 'last_30d', 'level': 'account', 'limit': '1'})
    campaigns_obj = fetch(f'{act_id}/campaigns', {'fields': 'id,status,effective_status', 'limit': '100'})
    active = 0
    paused = 0
    for item in campaigns_obj.get('data', []):
        status = (item.get('effective_status') or item.get('status') or '').upper()
        if status == 'ACTIVE': active += 1
        elif status in {'PAUSED', 'CAMPAIGN_PAUSED', 'ADSET_PAUSED', 'AD_PAUSED'}: paused += 1
    row = (insights.get('data') or [{}])[0]
    purchases = 0
    for action in row.get('actions', []):
        if action.get('action_type') in {'purchase', 'omni_purchase', 'offsite_conversion.fb_pixel_purchase'}:
            purchases = max(purchases, int(float(action.get('value', 0))))
    business_name = ((details.get('business') or {}).get('name') or (details.get('owner_business') or {}).get('name') or details.get('end_advertiser_name') or details.get('name') or account_id)
    account_name = details.get('name') or account_id
    return {
        'id': details['id'].replace('act_', ''),
        'name': account_name,
        'businessName': business_name,
        'platform': 'Meta Ads',
        'currency': details.get('currency', 'USD'),
        'lastUpdated': None,
        'summary': {
            'spend': round(float(row.get('spend', 0) or 0), 2),
            'clicks': int(float(row.get('clicks', 0) or 0)),
            'conversions': purchases,
            'cpa': round((float(row.get('spend', 0) or 0) / purchases), 2) if purchases else 0,
            'ctr': round(float(row.get('ctr', 0) or 0), 2),
            'activeCampaigns': active,
            'pausedCampaigns': paused,
        },
    }


def campaigns(account_id):
    act_id = account_id if str(account_id).startswith('act_') else f'act_{account_id}'
    obj = fetch(f'{act_id}/campaigns', {'fields': 'id,name,status,effective_status,objective,daily_budget,lifetime_budget', 'limit': '20'})
    insights = fetch(f'{act_id}/insights', {'fields': 'campaign_id,campaign_name,spend,clicks,cpc,ctr,actions', 'date_preset': 'last_30d', 'level': 'campaign', 'limit': '100'})
    metrics = {}
    for row in insights.get('data', []):
        purchases = 0
        for action in row.get('actions', []):
            if action.get('action_type') in {'purchase', 'omni_purchase', 'offsite_conversion.fb_pixel_purchase'}:
                purchases = max(purchases, int(float(action.get('value', 0))))
        metrics[row.get('campaign_id')] = {'spend': round(float(row.get('spend', 0) or 0), 2), 'clicks': int(float(row.get('clicks', 0) or 0)), 'conversions': purchases, 'ctr': round(float(row.get('ctr', 0) or 0), 2), 'avgCpc': round(float(row.get('cpc', 0) or 0), 2)}
    out = []
    for row in obj.get('data', []):
        m = metrics.get(row['id'], {})
        spend = m.get('spend', 0)
        conv = m.get('conversions', 0)
        daily = row.get('daily_budget')
        life = row.get('lifetime_budget')
        budget = round((float(daily or life or 0) / 100), 2) if (daily or life) else 0
        out.append({'id': row['id'], 'name': row.get('name', row['id']), 'status': row.get('effective_status', row.get('status', 'UNKNOWN')).title(), 'type': 'Meta Campaign', 'budgetDaily': budget, 'bidding': row.get('objective', 'Meta Objective').replace('_', ' ').title(), 'spend': spend, 'clicks': m.get('clicks', 0), 'conversions': conv, 'cpa': round(spend / conv, 2) if conv else 0, 'ctr': m.get('ctr', 0), 'avgCpc': m.get('avgCpc', 0)})
    out.sort(key=lambda x: x['spend'], reverse=True)
    return out


def campaign_detail(account_id, campaign_id):
    for campaign in campaigns(account_id):
        if campaign['id'] == str(campaign_id): return campaign
    return None


def alerts(account_id):
    camps = campaigns(account_id)
    alerts = []
    for c in camps[:10]:
        if c['spend'] >= 100 and c['conversions'] == 0:
            alerts.append({'severity': 'high', 'text': f"{c['name']} spent {c['spend']} with 0 conversions"})
        elif c['cpa'] and c['cpa'] > 50:
            alerts.append({'severity': 'medium', 'text': f"{c['name']} CPA is high at {c['cpa']}"})
    return alerts[:8]


if __name__ == '__main__':
    import sys
    cmd = sys.argv[1]
    if cmd == 'accounts': print(json.dumps(list_accounts()))
    elif cmd == 'summary': print(json.dumps(account_summary(sys.argv[2])))
    elif cmd == 'campaigns': print(json.dumps(campaigns(sys.argv[2])))
    elif cmd == 'campaign': print(json.dumps(campaign_detail(sys.argv[2], sys.argv[3])))
    elif cmd == 'alerts': print(json.dumps(alerts(sys.argv[2])))
    else: raise SystemExit(f'Unknown command: {cmd}')
