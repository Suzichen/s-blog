use napi_derive::napi;
use spage_scaffold::{ScaffoldInput, scaffold, cleanup};

#[napi(object)]
pub struct JsScaffoldInput {
    pub target_dir: String,
    pub name: String,
    pub description: String,
    pub author: String,
    pub site_url: Option<String>,
    pub timezone: Option<String>,
}

#[napi]
pub fn scaffold_blog(input: JsScaffoldInput) -> napi::Result<()> {
    let input = ScaffoldInput {
        target_dir: input.target_dir,
        name: input.name,
        description: input.description,
        author: input.author,
        site_url: input.site_url,
        timezone: input.timezone,
    };
    scaffold(&input).map_err(|e| napi::Error::from_reason(e.to_string()))
}

#[napi]
pub fn cleanup_blog(target_dir: String) {
    cleanup(&target_dir);
}
