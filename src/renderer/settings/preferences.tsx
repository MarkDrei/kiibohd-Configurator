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
          Keyboard layouts are bundled with the application. Firmware is compiled on this machine from local firmware
          sources, configured under the Firmware tab.
        </Typography>
      </CardContent>
    </Card>
  );
}
