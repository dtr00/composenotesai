#[derive(Debug, Clone, Copy)]
pub struct Bounded {
    pub min: f64,
    pub max: f64,
    pub default: f64,
}

impl Bounded {
    pub fn clamp(self, value: f64) -> f64 {
        if value.is_nan() {
            self.default
        } else {
            value.clamp(self.min, self.max)
        }
    }
}

#[derive(Debug, Clone, Copy)]
pub struct BoundedU32 {
    pub min: u32,
    pub max: u32,
    pub default: u32,
}

impl BoundedU32 {
    pub fn clamp(self, value: u32) -> u32 {
        value.clamp(self.min, self.max)
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn floats_are_clamped_and_nan_falls_back_to_the_default() {
        let range = Bounded { min: 0.05, max: 0.25, default: 0.1 };
        assert_eq!(range.clamp(0.2), 0.2);
        assert_eq!(range.clamp(0.0), 0.05);
        assert_eq!(range.clamp(0.6), 0.25);
        assert_eq!(range.clamp(f64::NAN), 0.1);
    }

    #[test]
    fn integers_are_clamped() {
        let range = BoundedU32 { min: 2, max: 9, default: 4 };
        assert_eq!(range.clamp(5), 5);
        assert_eq!(range.clamp(0), 2);
        assert_eq!(range.clamp(99), 9);
    }
}
