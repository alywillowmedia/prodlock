use super::schema;
use shopify_function::prelude::*;
use shopify_function::Result;
use serde::Deserialize;
use std::collections::HashSet;

#[derive(Debug, Default, Deserialize)]
#[serde(rename_all = "camelCase")]
struct ProdLockSettings {
    #[serde(default)]
    wholesale_emails: Vec<String>,
}

#[derive(Debug, Default, Deserialize)]
#[serde(rename_all = "camelCase")]
struct VisibilityResource {
    #[serde(default)]
    id: String,
    #[serde(default)]
    handle: String,
}

#[derive(Debug, Default, Deserialize)]
#[serde(rename_all = "camelCase")]
struct ProdLockVisibility {
    #[serde(default)]
    products: Vec<VisibilityResource>,
}

fn approved_emails(input: &schema::cart_validations_generate_run::Input) -> Vec<String> {
    input
        .shop()
        .settings_metafield()
        .map(|metafield| metafield.value())
        .and_then(|value| serde_json::from_str::<ProdLockSettings>(value).ok())
        .map(|settings| {
            settings
                .wholesale_emails
                .into_iter()
                .map(|email| email.trim().to_lowercase())
                .filter(|email| !email.is_empty())
                .collect()
        })
        .unwrap_or_default()
}

fn locked_products(input: &schema::cart_validations_generate_run::Input) -> HashSet<String> {
    let mut resources = HashSet::new();

    if let Some(visibility) = input
        .shop()
        .visibility_metafield()
        .map(|metafield| metafield.value())
        .and_then(|value| serde_json::from_str::<ProdLockVisibility>(value).ok())
    {
        for product in visibility.products {
            if !product.id.trim().is_empty() {
                resources.insert(product.id.trim().to_string());
            }

            if !product.handle.trim().is_empty() {
                resources.insert(product.handle.trim().to_string());
            }
        }
    }

    resources
}

#[shopify_function]
fn cart_validations_generate_run(
    input: schema::cart_validations_generate_run::Input,
) -> Result<schema::CartValidationsGenerateRunResult> {
    let locked_products_from_visibility = locked_products(&input);
    let customer_email = input
        .cart()
        .buyer_identity()
        .and_then(|buyer_identity| buyer_identity.email())
        .map(|email| email.trim().to_lowercase());

    let is_approved_customer = customer_email
        .as_ref()
        .map(|email| approved_emails(&input).contains(email))
        .unwrap_or(false);

    let locked_products: Vec<String> = input
        .cart()
        .lines()
        .iter()
        .filter_map(|line| match line.merchandise() {
            schema::cart_validations_generate_run::input::cart::lines::Merchandise::ProductVariant(
                variant,
            ) => {
                let product = variant.product();
                let is_locked_by_metafield = product
                    .metafield()
                    .map(|metafield| metafield.value() == "true")
                    .unwrap_or(false);
                let is_locked_by_visibility =
                    locked_products_from_visibility.contains(product.id())
                        || locked_products_from_visibility.contains(product.handle());

                if is_locked_by_metafield || is_locked_by_visibility {
                    Some(product.title().to_string())
                } else {
                    None
                }
            }
            _ => None,
        })
        .collect();

    if locked_products.is_empty() || is_approved_customer {
        return Ok(schema::CartValidationsGenerateRunResult {
            operations: Vec::new(),
        });
    }

    let message = if let Some(email) = customer_email {
        format!(
            "Your account ({email}) is not approved for wholesale checkout for: {}.",
            locked_products.join(", ")
        )
    } else {
        format!(
            "Please sign in with an approved wholesale account before purchasing: {}.",
            locked_products.join(", ")
        )
    };

    let operation = schema::ValidationAddOperation {
        errors: vec![schema::ValidationError {
            message,
            target: "$.cart".to_owned(),
        }],
    };

    Ok(schema::CartValidationsGenerateRunResult {
        operations: vec![schema::Operation::ValidationAdd(operation)],
    })
}
