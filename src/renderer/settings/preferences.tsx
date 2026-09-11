import React from 'react';
import { makeStyles, Card, CardHeader, CardContent, Typography } from '../mui';

const useStyles = makeStyles({
  text: {
    fontStyle: 'oblique',
  },
  card: {},
} as const);

export default function Preferences() {
  const classes = useStyles({});

  return (
    <Card className={classes.card}>
      <CardHeader title="Standalone mode" />
      <CardContent>
        <Typography className={classes.text}>
          Keyboard layouts are bundled with the application. Firmware compilation requires a trusted local toolchain.
        </Typography>
      </CardContent>
    </Card>
  );
}
