import { CardAction, CardDescription, CardHeader, CardTitle } from "../../../shared/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "../../../shared/ui/select";

interface SettingSelectProps<T extends string | number> {
  id: string;
  title: string;
  description: string;
  choices: readonly { value: T; label: string }[];
  value: T;
  onChange: (value: T) => void;
}

export function SettingSelect<T extends string | number>({
  id,
  title,
  description,
  choices,
  value,
  onChange,
}: SettingSelectProps<T>) {
  const labelId = `${id}-label`;

  return (
    <CardHeader id={id}>
      <CardTitle id={labelId}>{title}</CardTitle>
      <CardDescription>{description}</CardDescription>
      <CardAction className="self-center">
        <Select items={choices} value={value} onValueChange={(next: T | null) => next !== null && onChange(next)}>
          <SelectTrigger aria-labelledby={labelId} className="min-w-36">
            <SelectValue />
          </SelectTrigger>
          <SelectContent align="end">
            {choices.map((choice) => (
              <SelectItem key={choice.value} value={choice.value}>
                {choice.label}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </CardAction>
    </CardHeader>
  );
}
