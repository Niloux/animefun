use crate::models::bangumi::SubjectStatusCode;

#[derive(Debug, Clone, Copy, PartialEq, Eq)]
pub enum SubscriptionSort {
    AddedAt,
    Status,
    Rank,
    Score,
    Heat,
    Match,
}

impl SubscriptionSort {
    pub fn from_key(key: Option<&str>) -> Self {
        match key {
            Some("status") => Self::Status,
            Some("rank") => Self::Rank,
            Some("score") => Self::Score,
            Some("heat") => Self::Heat,
            Some("match") => Self::Match,
            _ => Self::AddedAt,
        }
    }
}

#[derive(Debug, PartialEq)]
pub struct SubscriptionQuery {
    pub keywords: Option<String>,
    pub sort: SubscriptionSort,
    pub genres: Vec<String>,
    pub min_rating: Option<f32>,
    pub max_rating: Option<f32>,
    pub status_code: Option<SubjectStatusCode>,
    pub limit: u32,
    pub offset: u32,
}

impl SubscriptionQuery {
    pub fn from_raw(
        keywords: Option<String>,
        sort: Option<String>,
        genres: Option<Vec<String>>,
        min_rating: Option<f32>,
        max_rating: Option<f32>,
        status_code: Option<SubjectStatusCode>,
        limit: Option<u32>,
        offset: Option<u32>,
    ) -> Self {
        Self {
            keywords: normalize_optional_text(keywords),
            sort: SubscriptionSort::from_key(sort.as_deref()),
            genres: normalize_list(genres),
            min_rating,
            max_rating,
            status_code,
            limit: limit.unwrap_or(20),
            offset: offset.unwrap_or(0),
        }
    }
}

#[derive(Debug, PartialEq)]
pub enum QueryBind {
    Integer(i64),
    Real(f32),
    Text(String),
}

#[derive(Debug, PartialEq)]
pub struct SubscriptionQueryPlan {
    pub where_sql: String,
    pub order_sql: String,
    pub filter_binds: Vec<QueryBind>,
    pub order_binds: Vec<QueryBind>,
    pub limit: i64,
    pub offset: i64,
}

pub fn status_ord(code: &SubjectStatusCode) -> i64 {
    match code {
        SubjectStatusCode::Airing => 0,
        SubjectStatusCode::PreAir => 1,
        SubjectStatusCode::Finished => 2,
        SubjectStatusCode::OnHiatus => 3,
        SubjectStatusCode::Unknown => 4,
    }
}

pub fn build_query_plan(query: &SubscriptionQuery) -> SubscriptionQueryPlan {
    let mut where_sql = String::new();
    let mut filter_binds = Vec::new();

    if let Some(keywords) = query.keywords.as_ref() {
        where_sql.push_str(" AND (LOWER(name) LIKE ? OR LOWER(name_cn) LIKE ?)");
        push_like_pair(&mut filter_binds, keywords);
    }

    for genre in query.genres.iter() {
        where_sql.push_str(" AND (tags_csv LIKE ?)");
        filter_binds.push(QueryBind::Text(format!("%,{genre},%")));
    }

    if let Some(min_rating) = query.min_rating {
        where_sql.push_str(" AND (rating_score IS NOT NULL AND rating_score >= ?)");
        filter_binds.push(QueryBind::Real(min_rating));
    }

    if let Some(max_rating) = query.max_rating {
        where_sql.push_str(" AND (rating_score IS NOT NULL AND rating_score <= ?)");
        filter_binds.push(QueryBind::Real(max_rating));
    }

    if let Some(code) = query.status_code.as_ref() {
        where_sql.push_str(" AND status_code = ?");
        filter_binds.push(QueryBind::Integer(status_ord(code)));
    }

    let mut order_binds = Vec::new();
    let order_sql = match query.sort {
        SubscriptionSort::Status => " ORDER BY status_ord ASC".to_string(),
        SubscriptionSort::Rank => {
            " ORDER BY (rating_rank IS NULL) ASC, rating_rank ASC".to_string()
        }
        SubscriptionSort::Score => " ORDER BY COALESCE(rating_score, 0) DESC".to_string(),
        SubscriptionSort::Heat => " ORDER BY COALESCE(rating_total, 0) DESC".to_string(),
        SubscriptionSort::Match => match query.keywords.as_ref() {
            Some(keywords) => {
                push_like_pair(&mut order_binds, keywords);
                " ORDER BY CASE WHEN LOWER(name) LIKE ? THEN 2 WHEN LOWER(name_cn) LIKE ? THEN 1 ELSE 0 END DESC".to_string()
            }
            None => " ORDER BY added_at DESC".to_string(),
        },
        SubscriptionSort::AddedAt => " ORDER BY added_at DESC".to_string(),
    };

    SubscriptionQueryPlan {
        where_sql,
        order_sql,
        filter_binds,
        order_binds,
        limit: query.limit as i64,
        offset: query.offset as i64,
    }
}

fn normalize_optional_text(value: Option<String>) -> Option<String> {
    value
        .map(|value| value.trim().to_lowercase())
        .filter(|value| !value.is_empty())
}

fn normalize_list(values: Option<Vec<String>>) -> Vec<String> {
    values
        .unwrap_or_default()
        .into_iter()
        .filter_map(|value| normalize_optional_text(Some(value)))
        .collect()
}

fn push_like_pair(binds: &mut Vec<QueryBind>, value: &str) {
    let like = format!("%{value}%");
    binds.push(QueryBind::Text(like.clone()));
    binds.push(QueryBind::Text(like));
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn normalizes_raw_query_values() {
        let query = SubscriptionQuery::from_raw(
            Some(" Fate ".to_string()),
            Some("score".to_string()),
            Some(vec![" Action ".to_string(), String::new()]),
            Some(7.0),
            None,
            Some(SubjectStatusCode::Airing),
            None,
            Some(40),
        );

        assert_eq!(query.keywords.as_deref(), Some("fate"));
        assert!(matches!(query.sort, SubscriptionSort::Score));
        assert_eq!(query.genres, vec!["action"]);
        assert_eq!(query.limit, 20);
        assert_eq!(query.offset, 40);
    }

    #[test]
    fn builds_match_sort_without_duplicate_keyword_filter() {
        let query = SubscriptionQuery::from_raw(
            Some("Fate".to_string()),
            Some("match".to_string()),
            None,
            None,
            None,
            None,
            Some(10),
            Some(0),
        );
        let plan = build_query_plan(&query);

        assert_eq!(
            plan.where_sql,
            " AND (LOWER(name) LIKE ? OR LOWER(name_cn) LIKE ?)"
        );
        assert_eq!(plan.filter_binds.len(), 2);
        assert_eq!(plan.order_binds.len(), 2);
        assert!(plan.order_sql.contains("CASE WHEN LOWER(name) LIKE ?"));
    }

    #[test]
    fn match_sort_without_keywords_falls_back_to_added_at() {
        let query = SubscriptionQuery::from_raw(
            None,
            Some("match".to_string()),
            None,
            None,
            None,
            None,
            None,
            None,
        );
        let plan = build_query_plan(&query);

        assert_eq!(plan.where_sql, "");
        assert_eq!(plan.order_sql, " ORDER BY added_at DESC");
        assert!(plan.filter_binds.is_empty());
        assert!(plan.order_binds.is_empty());
    }

    #[test]
    fn builds_filter_binds_in_where_clause_order() {
        let query = SubscriptionQuery::from_raw(
            Some("Fate".to_string()),
            Some("rank".to_string()),
            Some(vec!["Action".to_string(), " Magic ".to_string()]),
            Some(6.5),
            Some(9.0),
            Some(SubjectStatusCode::Finished),
            Some(50),
            Some(100),
        );
        let plan = build_query_plan(&query);

        assert_eq!(
            plan.filter_binds,
            vec![
                QueryBind::Text("%fate%".to_string()),
                QueryBind::Text("%fate%".to_string()),
                QueryBind::Text("%,action,%".to_string()),
                QueryBind::Text("%,magic,%".to_string()),
                QueryBind::Real(6.5),
                QueryBind::Real(9.0),
                QueryBind::Integer(status_ord(&SubjectStatusCode::Finished)),
            ]
        );
        assert_eq!(
            plan.order_sql,
            " ORDER BY (rating_rank IS NULL) ASC, rating_rank ASC"
        );
        assert_eq!(plan.limit, 50);
        assert_eq!(plan.offset, 100);
    }
}
