use crate::shared::error::{Error, Result};
use serde::{Deserialize, Serialize};
use std::collections::HashSet;

#[derive(Debug, PartialEq, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct Tab {
    pub id: u32,
    pub entries: Vec<String>,
    pub index: usize,
    pub group_id: Option<u32>,
}

#[derive(Debug, PartialEq, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct TabGroup {
    pub id: u32,
    pub name: String,
    pub collapsed: bool,
}

#[derive(Debug, Default, PartialEq, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct TabSession {
    pub tabs: Vec<Tab>,
    pub groups: Vec<TabGroup>,
    pub active_id: Option<u32>,
}

impl TabSession {
    pub fn validate(&self) -> Result<()> {
        let groups: HashSet<_> = self.groups.iter().map(|group| group.id).collect();
        let tabs: HashSet<_> = self.tabs.iter().map(|tab| tab.id).collect();
        if groups.len() != self.groups.len()
            || tabs.len() != self.tabs.len()
            || self.active_id.is_some_and(|id| !tabs.contains(&id))
            || self.tabs.iter().any(|tab| {
                tab.index >= tab.entries.len()
                    || tab.entries.iter().any(|path| !path.starts_with('/'))
                    || tab.group_id.is_some_and(|id| !groups.contains(&id))
            })
        {
            return Err(Error::Message("Saved tabs contain invalid session data.".into()));
        }
        Ok(())
    }
}
