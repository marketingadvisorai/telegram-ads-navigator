import json
import sys
import io
from contextlib import redirect_stdout
from pathlib import Path

ROOT = Path('/opt/openclaw/workspace/google-ads')
sys.path.insert(0, str(ROOT / 'scripts'))

from client import get_client, query as execute_query, load_config  # type: ignore


def money(micros):
    return float(micros or 0) / 1_000_000


def list_accounts():
    config = load_config()
    accounts = []
    for account in config.get('accounts', []):
        account_id = str(account.get('id', '')).replace('-', '')
        if not account_id:
            continue
        if any(a['id'] == account_id for a in accounts):
            continue
        accounts.append({
            'id': account_id,
            'name': account.get('name', account_id),
            'platform': 'Google Ads',
            'currency': account.get('currency', ''),
            'location': account.get('location', ''),
            'businessType': account.get('business_type', ''),
        })
    return accounts


def _client(customer_id: str):
    with redirect_stdout(io.StringIO()):
        return get_client(customer_id=customer_id)


def account_summary(customer_id: str):
    client = _client(customer_id)
    gaql = """
        SELECT
            customer.id,
            customer.descriptive_name,
            customer.currency_code,
            metrics.impressions,
            metrics.clicks,
            metrics.cost_micros,
            metrics.conversions
        FROM customer
        WHERE segments.date DURING LAST_30_DAYS
    """
    rows = execute_query(client, customer_id, gaql)
    if not rows:
        return None
    row = rows[0]

    gaql_campaigns = """
        SELECT
            campaign.status,
            campaign.id
        FROM campaign
        WHERE segments.date DURING LAST_30_DAYS
    """
    campaigns = execute_query(client, customer_id, gaql_campaigns)
    active = 0
    paused = 0
    for r in campaigns:
        status = r.campaign.status.name
        if status == 'ENABLED':
            active += 1
        elif status == 'PAUSED':
            paused += 1

    clicks = int(row.metrics.clicks or 0)
    cost = money(row.metrics.cost_micros)
    conversions = float(row.metrics.conversions or 0)
    cpa = round(cost / conversions, 2) if conversions else 0
    ctr = round((int(row.metrics.impressions or 0) and clicks / int(row.metrics.impressions or 0) * 100) or 0, 2)

    return {
        'id': str(row.customer.id),
        'name': row.customer.descriptive_name or customer_id,
        'platform': 'Google Ads',
        'currency': row.customer.currency_code,
        'lastUpdated': None,
        'summary': {
            'spend': round(cost, 2),
            'clicks': clicks,
            'conversions': round(conversions, 2),
            'cpa': cpa,
            'ctr': ctr,
            'activeCampaigns': active,
            'pausedCampaigns': paused,
        },
    }


def campaigns(customer_id: str):
    client = _client(customer_id)
    gaql = """
        SELECT
            campaign.id,
            campaign.name,
            campaign.status,
            campaign.advertising_channel_type,
            campaign.bidding_strategy_type,
            campaign_budget.amount_micros,
            metrics.impressions,
            metrics.clicks,
            metrics.cost_micros,
            metrics.conversions,
            metrics.average_cpc
        FROM campaign
        WHERE segments.date DURING LAST_30_DAYS
        ORDER BY metrics.cost_micros DESC
        LIMIT 20
    """
    rows = execute_query(client, customer_id, gaql)
    out = []
    for row in rows:
        cost = money(row.metrics.cost_micros)
        conversions = float(row.metrics.conversions or 0)
        clicks = int(row.metrics.clicks or 0)
        impressions = int(row.metrics.impressions or 0)
        out.append({
            'id': str(row.campaign.id),
            'name': row.campaign.name,
            'status': row.campaign.status.name.title(),
            'type': row.campaign.advertising_channel_type.name.replace('_', ' ').title(),
            'budgetDaily': round(money(row.campaign_budget.amount_micros), 2),
            'bidding': row.campaign.bidding_strategy_type.name.replace('_', ' ').title(),
            'spend': round(cost, 2),
            'clicks': clicks,
            'conversions': round(conversions, 2),
            'cpa': round(cost / conversions, 2) if conversions else 0,
            'ctr': round((clicks / impressions * 100), 2) if impressions else 0,
            'avgCpc': round(money(row.metrics.average_cpc), 2),
        })
    return out


def campaign_detail(customer_id: str, campaign_id: str):
    for campaign in campaigns(customer_id):
        if campaign['id'] == str(campaign_id):
            return campaign
    return None


def search_terms(customer_id: str, campaign_id: str):
    client = _client(customer_id)
    gaql = f"""
        SELECT
            campaign.id,
            campaign.name,
            search_term_view.search_term,
            metrics.impressions,
            metrics.clicks,
            metrics.cost_micros,
            metrics.conversions
        FROM search_term_view
        WHERE segments.date DURING LAST_30_DAYS
          AND campaign.id = {campaign_id}
        ORDER BY metrics.cost_micros DESC
        LIMIT 10
    """
    rows = execute_query(client, customer_id, gaql)
    out = []
    for row in rows:
        out.append({
            'campaignId': str(row.campaign.id),
            'campaignName': row.campaign.name,
            'term': row.search_term_view.search_term,
            'impressions': int(row.metrics.impressions or 0),
            'clicks': int(row.metrics.clicks or 0),
            'spend': round(money(row.metrics.cost_micros), 2),
            'conversions': round(float(row.metrics.conversions or 0), 2),
        })
    return out


if __name__ == '__main__':
    cmd = sys.argv[1]
    if cmd == 'accounts':
        print(json.dumps(list_accounts()))
    elif cmd == 'summary':
        print(json.dumps(account_summary(sys.argv[2])))
    elif cmd == 'campaigns':
        print(json.dumps(campaigns(sys.argv[2])))
    elif cmd == 'campaign':
        print(json.dumps(campaign_detail(sys.argv[2], sys.argv[3])))
    elif cmd == 'search_terms':
        print(json.dumps(search_terms(sys.argv[2], sys.argv[3])))
    else:
        raise SystemExit(f'Unknown command: {cmd}')
