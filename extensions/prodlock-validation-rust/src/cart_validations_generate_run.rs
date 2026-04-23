use super::schema;
use shopify_function::prelude::*;
use shopify_function::Result;
use serde::Deserialize;

#[derive(Debug, Default, Deserialize)]
#[serde(rename_all = "camelCase")]
struct ProdLockSettings {
    #[serde(default)]
    wholesale_emails: Vec<String>,
}

fn approved_emails(input: &schema::cart_validations_generate_run::Input) -> Vec<String> {
    input
        .shop()
        .metafield()
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

#[shopify_function]
fn cart_validations_generate_run(
    input: schema::cart_validations_generate_run::Input,
) -> Result<schema::CartValidationsGenerateRunResult> {
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
                let is_locked = product
                    .metafield()
                    .map(|metafield| metafield.value() == "true")
                    .unwrap_or(false);

                if is_locked {
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
