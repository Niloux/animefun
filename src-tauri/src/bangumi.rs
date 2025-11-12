use reqwest::header::{HeaderMap, HeaderValue, AUTHORIZATION, USER_AGENT};
use serde::{Deserialize, Serialize};
use serde_json::Value;

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct SlimSubject {
    pub id: u32,
    pub name: String,
    #[serde(rename = "nameCN", default)]
    pub name_cn: Option<String>,
    #[serde(rename = "type", default)]
    pub r#type: Option<u8>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct CalendarItem {
    pub subject: SlimSubject,
    pub watchers: u32,
}

pub type DailyBroadcast = Vec<CalendarItem>;

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct SubjectDetail {
    pub id: u32,
    pub name: String,
    #[serde(rename = "nameCN", default)]
    pub name_cn: Option<String>,
    #[serde(rename = "type", default)]
    pub r#type: Option<u8>,
}

#[derive(Debug, Clone, Serialize, Deserialize, Default)]
struct SearchWire {
    #[serde(default)]
    results: Vec<SlimSubject>,
    #[serde(default)]
    data: Vec<SlimSubject>,
    #[serde(default)]
    total: Option<u32>,
    #[serde(default)]
    limit: Option<u32>,
    #[serde(default)]
    offset: Option<u32>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct SubjectsPage {
    pub subjects: Vec<SlimSubject>,
    pub total: Option<u32>,
    pub limit: Option<u32>,
    pub offset: Option<u32>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct Episode {
    pub id: u32,
    pub name: String,
    #[serde(rename = "nameCN", default)]
    pub name_cn: Option<String>,
    #[serde(default)]
    pub ep: Option<u32>,
    #[serde(default)]
    pub airdate: Option<String>,
    #[serde(default)]
    pub duration: Option<String>,
    #[serde(rename = "type", default)]
    pub r#type: Option<u8>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct EpisodesPage {
    pub episodes: Vec<Episode>,
    pub total: Option<u32>,
    pub limit: Option<u32>,
    pub offset: Option<u32>,
}

pub struct BangumiClient {
    base: String,
    token: Option<String>,
}

impl BangumiClient {
    pub fn new(token: Option<String>) -> Self {
        Self {
            base: "https://api.bgm.tv".to_string(),
            token,
        }
    }

    fn headers(&self) -> HeaderMap {
        let mut h = HeaderMap::new();
        h.insert(USER_AGENT, HeaderValue::from_static("animefun/0.1"));
        if let Some(t) = &self.token {
            let v = format!("Bearer {}", t);
            if let Ok(hv) = HeaderValue::from_str(&v) {
                h.insert(AUTHORIZATION, hv);
            }
        }
        h
    }

    pub async fn daily(&self) -> Result<DailyBroadcast, String> {
        let url = format!("{}/calendar", self.base);
        let res = reqwest::Client::new()
            .get(url)
            .headers(self.headers())
            .send()
            .await
            .map_err(|e| e.to_string())?;
        let v = res.json::<Value>().await.map_err(|e| e.to_string())?;
        let mut out: DailyBroadcast = Vec::new();
        match v {
            Value::Array(arr) => {
                for it in arr {
                    if let (Some(subject), Some(watchers)) = (it.get("subject"), it.get("watchers"))
                    {
                        if let (Some(id), Some(name)) = (subject.get("id"), subject.get("name")) {
                            let id = id.as_u64().unwrap_or(0) as u32;
                            let name = name.as_str().unwrap_or("").to_string();
                            let name_cn = subject
                                .get("nameCN")
                                .and_then(|x| x.as_str())
                                .map(|s| s.to_string());
                            let r#type = subject
                                .get("type")
                                .and_then(|x| x.as_u64())
                                .map(|x| x as u8);
                            let watchers = watchers.as_u64().unwrap_or(0) as u32;
                            out.push(CalendarItem {
                                subject: SlimSubject {
                                    id,
                                    name,
                                    name_cn,
                                    r#type,
                                },
                                watchers,
                            });
                        }
                    }
                }
            }
            Value::Object(map) => {
                for (_k, v) in map.into_iter() {
                    if let Value::Array(arr) = v {
                        for it in arr {
                            if let (Some(subject), Some(watchers)) =
                                (it.get("subject"), it.get("watchers"))
                            {
                                if let (Some(id), Some(name)) =
                                    (subject.get("id"), subject.get("name"))
                                {
                                    let id = id.as_u64().unwrap_or(0) as u32;
                                    let name = name.as_str().unwrap_or("").to_string();
                                    let name_cn = subject
                                        .get("nameCN")
                                        .and_then(|x| x.as_str())
                                        .map(|s| s.to_string());
                                    let r#type = subject
                                        .get("type")
                                        .and_then(|x| x.as_u64())
                                        .map(|x| x as u8);
                                    let watchers = watchers.as_u64().unwrap_or(0) as u32;
                                    out.push(CalendarItem {
                                        subject: SlimSubject {
                                            id,
                                            name,
                                            name_cn,
                                            r#type,
                                        },
                                        watchers,
                                    });
                                }
                            }
                        }
                    }
                }
            }
            _ => {}
        }
        Ok(out)
    }

    pub async fn subject(&self, id: u32) -> Result<SubjectDetail, String> {
        let url = format!("{}/v0/subjects/{}", self.base, id);
        let res = reqwest::Client::new()
            .get(url)
            .headers(self.headers())
            .send()
            .await
            .map_err(|e| e.to_string())?;
        let v = res
            .json::<SubjectDetail>()
            .await
            .map_err(|e| e.to_string())?;
        Ok(v)
    }

    pub async fn search(
        &self,
        q: &str,
        type_: Option<u8>,
        limit: Option<u32>,
        offset: Option<u32>,
    ) -> Result<SubjectsPage, String> {
        let mut url = reqwest::Url::parse(&format!("{}/v0/search/subjects", self.base))
            .map_err(|e| e.to_string())?;
        {
            let mut qp = url.query_pairs_mut();
            qp.append_pair("q", q);
            if let Some(t) = type_ {
                qp.append_pair("type", &t.to_string());
            }
            if let Some(l) = limit {
                qp.append_pair("limit", &l.to_string());
            }
            if let Some(o) = offset {
                qp.append_pair("offset", &o.to_string());
            }
        }
        let res = reqwest::Client::new()
            .get(url)
            .headers(self.headers())
            .send()
            .await
            .map_err(|e| e.to_string())?;
        let raw = res.json::<SearchWire>().await.map_err(|e| e.to_string())?;
        let subjects = if !raw.results.is_empty() {
            raw.results
        } else {
            raw.data
        };
        Ok(SubjectsPage {
            subjects,
            total: raw.total,
            limit: raw.limit,
            offset: raw.offset,
        })
    }

    pub async fn episodes(
        &self,
        subject_id: u32,
        limit: Option<u32>,
        offset: Option<u32>,
    ) -> Result<EpisodesPage, String> {
        let mut url = reqwest::Url::parse(&format!("{}/v0/episodes", self.base))
            .map_err(|e| e.to_string())?;
        {
            let mut qp = url.query_pairs_mut();
            qp.append_pair("subject_id", &subject_id.to_string());
            if let Some(l) = limit {
                qp.append_pair("limit", &l.to_string());
            }
            if let Some(o) = offset {
                qp.append_pair("offset", &o.to_string());
            }
        }
        let res = reqwest::Client::new()
            .get(url)
            .headers(self.headers())
            .send()
            .await
            .map_err(|e| e.to_string())?;
        #[derive(Deserialize, Default)]
        struct WireObj {
            #[serde(default)]
            total: Option<u32>,
            #[serde(default)]
            limit: Option<u32>,
            #[serde(default)]
            offset: Option<u32>,
            #[serde(default)]
            data: Vec<Episode>,
            #[serde(default)]
            results: Vec<Episode>,
        }
        #[derive(Deserialize)]
        #[serde(untagged)]
        enum Wire {
            Obj(WireObj),
            Arr(Vec<Episode>),
        }
        let wire = res.json::<Wire>().await.map_err(|e| e.to_string())?;
        let page = match wire {
            Wire::Arr(arr) => EpisodesPage {
                episodes: arr,
                total: None,
                limit: None,
                offset: None,
            },
            Wire::Obj(obj) => {
                let episodes = if !obj.results.is_empty() {
                    obj.results
                } else {
                    obj.data
                };
                EpisodesPage {
                    episodes,
                    total: obj.total,
                    limit: obj.limit,
                    offset: obj.offset,
                }
            }
        };
        Ok(page)
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[tokio::test]
    async fn test_daily() {
        let c = BangumiClient::new(None);
        let v = c.daily().await.unwrap();
        assert!(v.len() >= 0);
    }

    #[tokio::test]
    async fn test_subject() {
        let c = BangumiClient::new(None);
        let v = c.subject(1).await.unwrap();
        assert_eq!(v.id, 1);
    }

    #[tokio::test]
    async fn test_search() {
        let c = BangumiClient::new(None);
        let v = c.search("eva", Some(2), Some(5), None).await.unwrap();
        assert!(v.subjects.len() <= 5);
    }

    #[tokio::test]
    async fn test_episodes() {
        let c = BangumiClient::new(None);
        let v = c.episodes(1, Some(5), None).await.unwrap();
        assert!(v.episodes.len() <= 5);
    }
}
