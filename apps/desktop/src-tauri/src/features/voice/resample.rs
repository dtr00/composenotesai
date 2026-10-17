pub fn to_rate(samples: &[f32], from: u32, to: u32) -> Vec<f32> {
    if from == to || samples.is_empty() {
        return samples.to_vec();
    }
    let ratio = f64::from(from) / f64::from(to);
    let len = (samples.len() as f64 / ratio) as usize;
    (0..len)
        .map(|i| {
            let start = (i as f64 * ratio) as usize;
            let end = (((i + 1) as f64 * ratio).ceil() as usize).clamp(start + 1, samples.len());
            let window = &samples[start..end];
            window.iter().sum::<f32>() / window.len() as f32
        })
        .collect()
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn same_rate_is_unchanged() {
        assert_eq!(to_rate(&[0.1, 0.2], 16_000, 16_000), vec![0.1, 0.2]);
    }

    #[test]
    fn downsamples_by_averaging_each_window() {
        assert_eq!(to_rate(&[1.0, 3.0, 5.0, 7.0, 9.0, 11.0], 48_000, 16_000), vec![3.0, 9.0]);
    }

    #[test]
    fn fractional_ratio_keeps_duration() {
        let one_second = vec![0.5; 44_100];
        assert_eq!(to_rate(&one_second, 44_100, 16_000).len(), 16_000);
    }

    #[test]
    fn upsamples_by_repeating_samples() {
        assert_eq!(to_rate(&[1.0, 2.0], 8_000, 16_000), vec![1.0, 1.0, 2.0, 2.0]);
    }

    #[test]
    fn empty_input_stays_empty() {
        assert!(to_rate(&[], 48_000, 16_000).is_empty());
    }
}
