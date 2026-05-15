// Feature: engine-cli-commands, Property 4: Port validation
//
// For any value outside [1, 65535] or any non-integer value as a port
// parameter, the parser should reject with an error mentioning the valid range.

use proptest::prelude::*;
use s_blog_engine::serve::parse_port;

proptest! {
    #![proptest_config(ProptestConfig::with_cases(100))]

    #[test]
    fn prop_port_zero_rejected(dummy in 0u32..1u32) {
        let _ = dummy;
        let result = parse_port("0");
        prop_assert!(result.is_err());
        let msg = result.unwrap_err();
        prop_assert!(msg.contains("1") && msg.contains("65535"), "error must mention valid range: {msg}");
    }

    #[test]
    fn prop_values_above_65535_rejected(val in 65536u32..=u32::MAX) {
        let result = parse_port(&val.to_string());
        prop_assert!(result.is_err());
        let msg = result.unwrap_err();
        prop_assert!(msg.contains("1") && msg.contains("65535"), "error must mention valid range: {msg}");
    }

    #[test]
    fn prop_non_integer_rejected(s in "[a-zA-Z][a-zA-Z0-9]{0,10}") {
        let result = parse_port(&s);
        prop_assert!(result.is_err());
        let msg = result.unwrap_err();
        prop_assert!(msg.contains("1") && msg.contains("65535"), "error must mention valid range: {msg}");
    }

    #[test]
    fn prop_valid_ports_accepted(val in 1u16..=65535u16) {
        let result = parse_port(&val.to_string());
        prop_assert!(result.is_ok());
        prop_assert_eq!(result.unwrap(), val);
    }
}
