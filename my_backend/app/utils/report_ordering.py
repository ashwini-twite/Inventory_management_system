# app/utils/report_ordering.py

REPORT_ORDER_FIELDS = {
    "payments": "Created_at",
    "movement": "Scan_date",
    "returns": "return_date",
    "sales": "Scan_date",
}

def apply_order(query, report_type: str):
    """
    Apply newest-first ordering to a Supabase query
    based on report type.
    """
    field = REPORT_ORDER_FIELDS.get(report_type)
    if field:
        return query.order(field, desc=True)
    return query
